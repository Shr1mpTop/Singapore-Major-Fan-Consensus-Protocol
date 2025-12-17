# -*- coding: utf-8 -*-
import os
from urllib.parse import quote
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from web3 import Web3
from dotenv import load_dotenv
import threading
import time
import requests
from datetime import datetime, timezone
from sqlalchemy import func, cast, Numeric
import urllib.parse

# --- 1. 初始化与配置 ---

# 加载环境变量
load_dotenv()
steamdt_api_key = os.getenv("STEAMDT_API_KEY")
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY")
RPC_URL = os.getenv("RPC_URL")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS")

# 初始化 Flask App
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": "*",  
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# 配置 SQLite 数据库
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'fan_consensus.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Web3 配置
web3 = Web3(Web3.HTTPProvider(RPC_URL))
with open(os.path.join(os.path.dirname(__file__), 'abi.json'), 'r') as f:
    CONTRACT_ABI = json.load(f)
contract = web3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)


VOTE_METHOD_ID = "0x0121b93f" 
NEW_VOTE_EVENT_TOPIC = "0x7a5b3252a1a5b2812a8323a1a6b0853509e4f5a3e14ea839f408b0c498a442a9" 

# 全局状态变量
threads_started = False
bg_thread_semaphore = threading.Semaphore(1)
bg_running_count = 0
bg_count_lock = threading.Lock()

# 游戏状态枚举映射 (新增 Refunding)
GAME_STATUS_MAP = {0: "Open", 1: "Stopped", 2: "Finished", 3: "Refunding"}

# --- 2. 数据库模型 (Models) ---

class Weapon(db.Model):
    """缓存CS2武器价格"""
    hash_name = db.Column(db.String(255), primary_key=True)
    price_usd = db.Column(db.Float, default=0.0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GameState(db.Model):
    """存储游戏的全局状态"""
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.Integer, default=0)
    total_prize_pool = db.Column(db.String(50), default="0")
    winning_team_id = db.Column(db.Integer, nullable=True)

class Team(db.Model):
    """存储战队信息"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    total_vote_amount = db.Column(db.String(50), default="0")
    supporter_count = db.Column(db.Integer, default=0)

class UserVote(db.Model):
    """记录每个用户的投票 - 包含所有Etherscan API字段"""
    id = db.Column(db.Integer, primary_key=True)
    user_address = db.Column(db.String(42))
    team_id = db.Column(db.Integer)
    amount_wei = db.Column(db.String(50))
    block_number = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime)
    hash = db.Column(db.String(66), unique=True)
    # ... 其他Etherscan字段
    nonce = db.Column(db.String(50))
    block_hash = db.Column(db.String(66))
    transaction_index = db.Column(db.String(50))
    gas = db.Column(db.String(50))
    gas_price = db.Column(db.String(50))
    is_error = db.Column(db.String(10))
    tx_receipt_status = db.Column(db.String(10))
    input_data = db.Column(db.Text)
    contract_address = db.Column(db.String(42))
    cumulative_gas_used = db.Column(db.String(50))
    gas_used = db.Column(db.String(50))
    confirmations = db.Column(db.String(50))
    method_id = db.Column(db.String(10))
    function_name = db.Column(db.String(255))

# --- 3. 核心后端逻辑 ---

def get_logo_url(team_name):
    """根据队名生成本地Logo URL"""
    # 本地文件映射
    logo_mapping = {
        "Vitality": "/teams/vitality.webp",
        "Spirit": "/teams/spirit.webp",
        "ENCE": "/teams/ence.svg",
        "Heroic": "/teams/heroic.webp",
        "NaVi": "/teams/NatusVincere.svg",
        "FaZe": "/teams/FaZeClan.webp",
        "G2": "/teams/g2esports.webp",
        "Tyloo": "/teams/tyloo.svg",
    }
    return logo_mapping.get(team_name, "/teams/default.svg")

def update_team_stats():
    """从智能合约同步战队统计数据"""
    with app.app_context():
        try:
            teams_data = contract.functions.getTeams().call()
            for team_data in teams_data:
                team_id, name, total_vote, supporters = team_data
                team = db.session.get(Team, team_id)
                if team:
                    team.total_vote_amount = str(total_vote)
                    team.supporter_count = int(supporters)
                else:
                    team = Team(
                        id=int(team_id),
                        name=name,
                        total_vote_amount=str(total_vote),
                        supporter_count=int(supporters)
                    )
                    db.session.add(team)
            db.session.commit()
            print("✅ Team stats updated from contract.")
        except Exception as e:
            print(f"❌ Error updating team stats: {e}")
            db.session.rollback()

def update_game_status():
    """从智能合约同步游戏状态"""
    with app.app_context():
        try:
            contract_status = contract.functions.status().call()
            contract_pool = contract.functions.totalRewardPool().call()
            
            game_state = GameState.query.first()
            if not game_state:
                game_state = GameState(id=1)
                db.session.add(game_state)
            
            if game_state.status != contract_status:
                print(f"🔄 Game status changed from {GAME_STATUS_MAP.get(game_state.status, 'Unknown')} to {GAME_STATUS_MAP.get(contract_status, 'Unknown')}")
                game_state.status = contract_status
                
                if contract_status == 2: # Finished
                     winning_id = contract.functions.winningTeamId().call()
                     game_state.winning_team_id = winning_id
                     print(f"🏆 Winner Selected: Team {winning_id}")
                
                if contract_status in [1, 2, 3]: # Stopped, Finished, or Refunding
                    print("🎯 Game ended or entered refunding! Saving all user votes...")
                    save_all_user_votes_to_database()

            game_state.total_prize_pool = str(contract_pool)
            db.session.commit()
        except Exception as e:
            print(f"❌ Error updating game status: {e}")
            db.session.rollback()


def setup_event_listeners():
    """设置智能合约事件监听器，实现实时数据同步"""
    
    def event_listener():
        """使用Etherscan API监听合约事件"""
        try:
            latest_block = web3.eth.block_number
            last_checked_block = latest_block - 10 
            processed_tx_hashes = set()
            
            print(f"👂 Event listener started")
            
            while True:
                try:
                    # 每次循环都检查游戏状态（管理员可能调用了stopBetting/finishGame）
                    update_game_status()
                    
                    transactions = get_contract_transactions_from_etherscan(start_block=last_checked_block + 1)
                    
                    if transactions:
                        new_vote_found = False
                        for tx in transactions:
                            tx_hash = tx.get('hash')
                            if tx_hash in processed_tx_hashes:
                                continue
                            
                            processed_tx_hashes.add(tx_hash)
                            
                            if tx.get('isError') == '0' and tx.get('input', '').startswith(VOTE_METHOD_ID):
                                new_vote_found = True
                        
                        if new_vote_found:
                            print("🚀 New vote detected, updating team stats...")
                            update_team_stats()

                        last_checked_block = max(int(tx.get('blockNumber')) for tx in transactions)

                except Exception as e:
                    print(f"Error in event loop: {e}")
                
                time.sleep(30)
                
        except Exception as e:
            print(f"FATAL: Event listener failed: {e}")

    safe_start_thread("EtherscanListener", event_listener)


# --- 4. API Endpoints ---

@app.route('/api/voting_history/<user_address>', methods=['GET'])
def get_user_voting_history(user_address):
    """获取用户的投票历史和收益计算"""
    try:
        # 将地址转换为小写以匹配数据库格式
        user_address = user_address.lower()
        
        game_state = GameState.query.first()
        teams = Team.query.all()
        teams_data = [{"id": t.id, "name": t.name} for t in teams]
        
        votes = UserVote.query.filter_by(user_address=user_address).all()
        
        if not votes:
            return jsonify({
                "total_votes": 0, "total_invested_eth": 0,
                "total_returned_eth": 0, "total_profit_eth": 0,
                "votes": []
            })

        total_invested_eth = 0
        total_returned_eth = 0
        vote_history = []
        win_count = 0

        for vote in votes:
            vote_amount_eth = float(web3.from_wei(int(vote.amount_wei), 'ether'))
            total_invested_eth += vote_amount_eth

            team_info = next((t for t in teams_data if t["id"] == vote.team_id), None)
            team_name = team_info["name"] if team_info else f"Team {vote.team_id}"
            
            status = "Pending"
            payout = 0

            if game_state and game_state.status == 2: # Finished
                if vote.team_id == game_state.winning_team_id:
                    status = "Won"
                    win_count += 1
                    try:
                        total_pool_wei = int(game_state.total_prize_pool)
                        charity_amount = (total_pool_wei * 10) // 100
                        total_distributable = total_pool_wei - charity_amount
                        
                        winning_team = db.session.get(Team, game_state.winning_team_id)
                        winner_total_vote = int(winning_team.total_vote_amount) if winning_team else 0
                        
                        if winner_total_vote > 0:
                            payout = (int(vote.amount_wei) * total_distributable) / winner_total_vote
                        
                        total_returned_eth += float(web3.from_wei(payout, 'ether'))
                    except Exception as e:
                        print(f"Payout calculation error: {e}")
                else:
                    status = "Lost"
            elif game_state and game_state.status == 3: # Refunding
                status = "Refunded"
                payout = int(vote.amount_wei) # 全额退款
                total_returned_eth += vote_amount_eth

            vote_history.append({
                "team_id": vote.team_id,
                "team_name": team_name,
                "amount_eth": vote_amount_eth,
                "status": status,
                "payout_eth": float(web3.from_wei(payout, 'ether')),
                "timestamp": vote.timestamp.isoformat() if vote.timestamp else None
            })

        total_profit_eth = total_returned_eth - total_invested_eth
        win_rate = (win_count / len(votes)) * 100 if votes else 0
        
        return jsonify({
            "total_votes": len(votes),
            "total_invested_eth": total_invested_eth,
            "total_returned_eth": total_returned_eth,
            "total_profit_eth": total_profit_eth,
            "win_rate": win_rate,
            "votes": vote_history
        })
    except Exception as e:
        print(f"Error getting user voting history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/record_vote', methods=['POST'])
def record_vote():
    """记录用户投票"""
    data = request.get_json()
    # ... (与旧版 record_bet 类似的逻辑, 但使用新变量)
    try:
        new_vote = UserVote(
            user_address=data.get('userAddress').lower(),  # 统一转换为小写
            team_id=data.get('teamId'),
            amount_wei=data.get('amount'),
            hash=data.get('txHash'),
            timestamp=datetime.now(timezone.utc)
        )
        db.session.add(new_vote)
        db.session.commit()
        
        print("🚀 New vote recorded, triggering stats update...")
        update_team_stats()
        
        return jsonify({"message": "Vote recorded and stats updated successfully", "vote_id": new_vote.id})
    except Exception as e:
        print(f"❌ Error recording vote: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

def get_eth_price_usd():
    # This is a helper from the old app, simplified for stats
    try:
        response = requests.get("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT", timeout=5)
        response.raise_for_status()
        return float(response.json()["price"])
    except:
        return 3000.0 # Fallback

def get_weapon_image(weapon_name):
    """根据武器全名映射到简化的图片文件名"""
    # 武器名称到图片文件的映射
    weapon_img_mapping = {
        "AWP | Dragon Lore (Factory New)": "/skins/Dragon.webp",
        "★ Butterfly Knife | Crimson Web (Factory New)": "/skins/Butterfly.webp",
        "★ Karambit | Gamma Doppler (Factory New)": "/skins/Karambit.webp",
        "★ Sport Gloves | Nocts (Field-Tested)": "/skins/SportGloves.webp",
        "StatTrak™ AK-47 | Vulcan (Well-Worn)": "/skins/AK-47.webp",
        "M4A4 | Hellish (Minimal Wear)": "/skins/Hellish.webp",
        "Souvenir Galil AR | CAUTION! (Factory New)": "/skins/Galil.webp",
        "Crasswater The Forgotten | Guerrilla Warfare": "/skins/GuerrillaWarfare.webp",
        "StatTrak™ Music Kit | TWERL and Ekko & Sidetrack, Under Bright Lights": "/skins/MusicKit.webp",
        "MAC-10 | Tatter (Well-Worn)": "/skins/MAC-10.webp",
        "Tec-9 | Groundwater (Battle-Scarred)": "/skins/Tec-9.webp",
    }
    return weapon_img_mapping.get(weapon_name, "/skins/default.webp")

def update_weapon_prices():
    """从bufftracker API更新武器价格数据"""
    print("\n🔄 Updating weapon prices from bufftracker API...")
    
    # 武器hash_name列表
    weapon_names = [
        "AWP | Dragon Lore (Factory New)",
        "★ Butterfly Knife | Crimson Web (Factory New)",
        "★ Karambit | Gamma Doppler (Factory New)",
        "★ Sport Gloves | Nocts (Field-Tested)",
        "StatTrak™ AK-47 | Vulcan (Well-Worn)",
        "M4A4 | Hellish (Minimal Wear)",
        "Souvenir Galil AR | CAUTION! (Factory New)",
        "Crasswater The Forgotten | Guerrilla Warfare",
        "StatTrak™ Music Kit | TWERL and Ekko & Sidetrack, Under Bright Lights",
        "MAC-10 | Tatter (Well-Worn)",
        "Tec-9 | Groundwater (Battle-Scarred)",
    ]
    
    # 获取CNY到USD汇率
    exchange_rate = 0.14  # 默认汇率
    try:
        exchange_response = requests.get(
            "https://api.frankfurter.app/latest?from=CNY&to=USD",
            timeout=5
        )
        if exchange_response.status_code == 200:
            exchange_rate = exchange_response.json()['rates']['USD']
            print(f"  ✓ Exchange rate: 1 CNY = {exchange_rate} USD")
    except Exception as e:
        print(f"  ⚠ Failed to get exchange rate, using default: {e}")
    
    # 平台优先级
    PLATFORM_PRIORITY = ["BUFF", "C5", "YOUPIN", "STEAM"]
    
    with app.app_context():
        updated_count = 0
        failed_count = 0
        
        for weapon_name in weapon_names:
            try:
                # URL编码武器名称
                encoded_name = urllib.parse.quote(weapon_name)
                api_url = f"https://buffotte.hezhili.online/api/bufftracker/price/{encoded_name}"
                
                response = requests.get(api_url, timeout=10)
                response.raise_for_status()
                result = response.json()
                
                # 从响应中提取价格数据
                # API返回格式: {"data": [{"platform": "BUFF", "sellPrice": 123, "sellCount": 5}, ...]}
                price_data_list = result.get('data', [])
                price_cny = None
                selected_platform = None
                
                # 如果data是列表，转换为字典
                if isinstance(price_data_list, list):
                    price_data = {}
                    for item in price_data_list:
                        platform = item.get('platform', '')
                        if platform:
                            price_data[platform] = item
                else:
                    price_data = price_data_list
                
                # 按优先级选择平台价格
                for platform in PLATFORM_PRIORITY:
                    if platform in price_data:
                        platform_info = price_data[platform]
                        sell_price = platform_info.get('sellPrice', 0)
                        sell_count = platform_info.get('sellCount', 0)
                        
                        if sell_price > 0 and sell_count > 0:
                            price_cny = sell_price
                            selected_platform = platform
                            break
                
                # 如果优先平台没有价格，尝试任何有效价格
                if price_cny is None:
                    for platform, platform_info in price_data.items():
                        sell_price = platform_info.get('sellPrice', 0)
                        sell_count = platform_info.get('sellCount', 0)
                        
                        if sell_price > 0 and sell_count > 0:
                            price_cny = sell_price
                            selected_platform = platform
                            break
                
                if price_cny and price_cny > 0:
                    # 转换为USD
                    price_usd = price_cny * exchange_rate
                    
                    # 更新数据库
                    weapon = Weapon.query.filter_by(hash_name=weapon_name).first()
                    if weapon:
                        weapon.price_usd = price_usd
                        weapon.last_updated = datetime.now(timezone.utc)
                    else:
                        weapon = Weapon(
                            hash_name=weapon_name,
                            price_usd=price_usd,
                            last_updated=datetime.now(timezone.utc)
                        )
                        db.session.add(weapon)
                    
                    updated_count += 1
                    print(f"  ✓ {weapon_name[:50]}... [{selected_platform}]: ¥{price_cny:.2f} → ${price_usd:.2f}")
                else:
                    print(f"  ⚠ {weapon_name[:50]}... No valid price data")
                    failed_count += 1
                    
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 404:
                    print(f"  ⚠ {weapon_name[:50]}... Not found in API (404)")
                else:
                    print(f"  ❌ {weapon_name[:50]}... HTTP Error: {e}")
                failed_count += 1
            except Exception as e:
                print(f"  ❌ {weapon_name[:50]}... Error: {e}")
                failed_count += 1
        
        db.session.commit()
        print(f"\n✓ Updated {updated_count} weapon prices")
        if failed_count > 0:
            print(f"⚠ Failed to update {failed_count} weapons (will keep cached prices if available)")




@app.route('/api/stats', methods=['GET'])
def get_stats():
    """获取全局统计数据"""
    try:
        total_unique_participants = db.session.query(UserVote.user_address).distinct().count()
        total_votes = UserVote.query.count()
        
        game_state = GameState.query.first()
        total_prize_pool_eth = 0
        if game_state and game_state.total_prize_pool:
            total_prize_pool_eth = float(web3.from_wei(int(game_state.total_prize_pool), 'ether'))
        
        # 计算武器等价物
        weapon_equivalents = []
        try:
            eth_price_usd = get_eth_price_usd()
            total_prize_pool_usd = total_prize_pool_eth * eth_price_usd
            
            # 获取所有武器数据
            weapons = Weapon.query.all()
            
            for weapon in weapons:
                if weapon.price_usd > 0:
                    count = total_prize_pool_usd / weapon.price_usd
                    raw_count = int(count)
                    progress = (count - raw_count) * 100  # 进度百分比
                    
                    weapon_equivalents.append({
                        "name": weapon.hash_name,
                        "count": count,
                        "raw_count": raw_count,
                        "progress": progress,
                        "price_usd": weapon.price_usd,
                        "img": get_weapon_image(weapon.hash_name)
                    })
            
            # 按价格升序排序,先显示便宜的武器（用户能买得起的）
            weapon_equivalents.sort(key=lambda x: x['price_usd'])
            
        except Exception as e:
            print(f"⚠️ Error calculating weapon equivalents: {e}")
            weapon_equivalents = []

        return jsonify({
            "total_unique_participants": total_unique_participants,
            "total_votes": total_votes,
            "total_prize_pool_eth": total_prize_pool_eth,
            "weapon_equivalents": weapon_equivalents
        })
    except Exception as e:
        # 详细记录错误，以便调试
        import traceback
        print(f"❌❌❌ CRITICAL ERROR in get_stats: {e}")
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred while fetching stats."}), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取当前游戏状态和奖池"""
    state = GameState.query.first()
    if not state:
        return jsonify({
            "status": 0, "status_text": "Open",
            "total_prize_pool_eth": 0, "winning_team_id": None
        })
    
    return jsonify({
        "status": state.status,
        "status_text": GAME_STATUS_MAP.get(state.status, "Unknown"),
        "total_prize_pool_eth": float(web3.from_wei(int(state.total_prize_pool), 'ether')),
        "winning_team_id": state.winning_team_id
    })

@app.route('/api/teams', methods=['GET'])
def get_teams():
    """获取所有战队列表及当前支持率数据"""
    teams = Team.query.order_by(Team.id).all()
    result = []
    
    for t in teams:
        result.append({
            "id": t.id,
            "name": t.name,
            "logo_url": get_logo_url(t.name),
            "total_vote_amount_eth": float(web3.from_wei(int(t.total_vote_amount), 'ether')),
            "supporter_count": t.supporter_count
        })
    return jsonify(result)

# --- 5. 工具与辅助函数 ---

def get_contract_transactions_from_etherscan(start_block=0):
    """从Etherscan API获取合约的所有交易 - 按照官方文档格式"""
    # 根据官方文档: https://docs.etherscan.io/api-reference/endpoint/txlist
    API_URL = f"https://api.etherscan.io/v2/api"
    params = {
        'chainid': '11155111',  # Sepolia chainid
        'module': 'account',
        'action': 'txlist',
        'address': CONTRACT_ADDRESS,
        'startblock': str(start_block),
        'endblock': '99999999',
        'page': '1',
        'offset': '100',  # 获取最近100条
        'sort': 'desc',  # 从最新到最旧
        'apikey': ETHERSCAN_API_KEY
    }
    try:
        response = requests.get(API_URL, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == '1':
            transactions = data['result']
            vote_txs = [tx for tx in transactions if tx.get('input', '').startswith(VOTE_METHOD_ID)]
            if vote_txs:
                print(f"🎯 Found {len(vote_txs)} vote transaction(s)")
            return transactions
        else:
            if data.get('message') != 'No transactions found':
                print(f"⚠️ Etherscan API: {data.get('message', 'Unknown error')}")
            return []
    except requests.RequestException as e:
        print(f"❌ Etherscan API request failed: {e}")
        return []

def save_all_user_votes_to_database():
    """使用Etherscan API保存所有用户的投票记录到数据库"""
    try:
        transactions = get_contract_transactions_from_etherscan()
        if not transactions:
            return

        with app.app_context():
            saved_count = 0
            for tx in transactions:
                if tx.get('isError') == '0' and tx.get('input', '').startswith(VOTE_METHOD_ID):
                    tx_hash = tx.get('hash')
                    existing_vote = UserVote.query.filter_by(hash=tx_hash).first()
                    if not existing_vote:
                        try:
                            # 解码 input data 来获取 teamId
                            input_data = tx.get('input', '')
                            team_id = int(input_data[len(VOTE_METHOD_ID):], 16)

                            new_vote = UserVote(
                                user_address=tx.get('from').lower(),  # 统一转换为小写
                                team_id=team_id,
                                amount_wei=tx.get('value'),
                                block_number=tx.get('blockNumber'),
                                timestamp=datetime.fromtimestamp(int(tx.get('timeStamp')), tz=timezone.utc),
                                hash=tx_hash,
                                nonce=tx.get('nonce'),
                                block_hash=tx.get('blockHash'),
                                transaction_index=tx.get('transactionIndex'),
                                gas=tx.get('gas'),
                                gas_price=tx.get('gasPrice'),
                                is_error=tx.get('isError'),
                                tx_receipt_status=tx.get('txreceipt_status'),
                                input_data=input_data,
                                contract_address=tx.get('to'),
                                cumulative_gas_used=tx.get('cumulativeGasUsed'),
                                gas_used=tx.get('gasUsed'),
                                confirmations=tx.get('confirmations'),
                                method_id=tx.get('methodId'),
                                function_name=tx.get('functionName')
                            )
                            db.session.add(new_vote)
                            db.session.commit()
                            saved_count += 1
                        except Exception as e:
                            print(f"  ❌ Error saving tx {tx_hash[:10]}...: {e}")
                            db.session.rollback()
            if saved_count > 0:
                print(f"✅ Saved {saved_count} new voting record(s)")
    except Exception as e:
        print(f"❌ Error saving user votes to database: {e}")

def safe_start_thread(name, target, *args, **kwargs):
    """安全地启动后台线程"""
    acquired = bg_thread_semaphore.acquire(blocking=False)
    if not acquired:
        print(f"Skipping starting {name}: max background threads reached")
        return None

    def wrapper(*a, **k):
        global bg_running_count
        with bg_count_lock:
            bg_running_count += 1
        print(f"🧵 Thread '{name}' started.")
        try:
            target(*a, **k)
        except Exception as e:
            print(f"💥 Unhandled exception in thread '{name}': {e}")
        finally:
            with bg_count_lock:
                bg_running_count -= 1
            bg_thread_semaphore.release()
            print(f"🧵 Thread '{name}' finished.")

    thread = threading.Thread(name=name, target=wrapper, args=args, kwargs=kwargs, daemon=True)
    thread.start()
    return thread

def start_background_threads():
    """启动后台线程 (只执行一次)"""
    global threads_started
    if not threads_started:
        print("🔄 Starting background sync...")
        save_all_user_votes_to_database()
        setup_event_listeners()
        threads_started = True

# --- 6. 启动应用 ---

# 使用 before_first_request 的替代方案
_initialized = False

@app.before_request
def initialize_app():
    global _initialized
    if _initialized:
        return
    
    _initialized = True
    # 确保数据库和表已创建
    with app.app_context():
        db.create_all()
    
    # 首次请求时启动后台线程
    start_background_threads()

def auto_reset_database():
    """自动重置数据库（保留武器名称）"""
    print("=" * 60)
    print("🔄 AUTO DATABASE RESET ON STARTUP")
    print("=" * 60)
    
    with app.app_context():
        # Step 1: Backup weapon names
        print(f"\n[1/4] Backing up weapon names...")
        weapon_names = []
        try:
            weapons = Weapon.query.all()
            weapon_names = [w.hash_name for w in weapons]
            print(f"✓ Backed up {len(weapon_names)} weapon names")
        except Exception as e:
            print(f"⚠ Could not backup weapons: {e}")
        
        # Step 2: Clear all tables (except weapon names)
        print(f"\n[2/4] Clearing table data...")
        
        # Clear UserVote table
        try:
            deleted = db.session.query(UserVote).delete()
            print(f"  ✓ Cleared {deleted} user votes")
        except Exception as e:
            print(f"  ⚠ Error clearing user votes: {e}")
        
        # Clear Team table
        try:
            deleted = db.session.query(Team).delete()
            print(f"  ✓ Cleared {deleted} teams")
        except Exception as e:
            print(f"  ⚠ Error clearing teams: {e}")
        
        # Clear GameState table
        try:
            deleted = db.session.query(GameState).delete()
            print(f"  ✓ Cleared {deleted} game states")
        except Exception as e:
            print(f"  ⚠ Error clearing game states: {e}")
        
        db.session.commit()
        
        # Step 2.5: Update weapon prices (instead of clearing)
        print(f"\n[2.5/4] Updating weapon prices...")
        update_weapon_prices()
        
        # Step 3: Initialize GameState
        print("\n[3/4] Initializing game state...")
        # 检查是否已存在GameState
        game_state = GameState.query.filter_by(id=1).first()
        if not game_state:
            game_state = GameState(
                id=1,
                status=0,
                total_prize_pool="0",
                winning_team_id=None
            )
            db.session.add(game_state)
            db.session.commit()
            print("✓ Game state initialized")
        else:
            # 如果已存在，重置为初始状态
            game_state.status = 0
            game_state.total_prize_pool = "0"
            game_state.winning_team_id = None
            db.session.commit()
            print("✓ Game state reset to initial state")
        
        # Step 4: Sync teams from contract
        print("\n[4/4] Syncing teams from contract...")
        try:
            teams_data = contract.functions.getTeams().call()
            print(f"Found {len(teams_data)} teams in contract")
            
            for team_data in teams_data:
                team_id, name, total_vote, supporters = team_data
                team = Team(
                    id=int(team_id),
                    name=name,
                    total_vote_amount="0",
                    supporter_count=0
                )
                db.session.add(team)
                print(f"  - Added team: {name} (ID: {team_id})")
            
            db.session.commit()
            print("✓ Teams synced successfully")
            
        except Exception as e:
            print(f"✗ Error syncing teams: {e}")
            db.session.rollback()
    
    print("\n" + "=" * 60)
    print("✅ DATABASE RESET COMPLETE!")
    print("=" * 60)

if __name__ == '__main__':
    # 在运行 app 之前，确保 instance 文件夹存在
    instance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
    if not os.path.exists(instance_path):
        os.makedirs(instance_path)
    
    # 初始化数据库
    with app.app_context():
        db.create_all()
        print("✅ Database tables created")
        
        # 🔥 每次启动时自动重置数据库
        auto_reset_database()
        
        # 同步合约状态
        print("\n🔄 Syncing contract data...")
        update_team_stats()
        update_game_status()
        
        # 启动时同步历史数据
        print("🔄 Syncing historical data...")
        save_all_user_votes_to_database()
        
        # 启动事件监听
        setup_event_listeners()
    
    app.run(host='0.0.0.0', port=5001, debug=True)
