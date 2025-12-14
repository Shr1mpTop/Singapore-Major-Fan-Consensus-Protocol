import os
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from web3 import Web3
from dotenv import load_dotenv
import threading
import time
import requests
from datetime import datetime, timezone # Added timezone
from sqlalchemy import func, cast, Numeric
import urllib.parse # For URL encoding

# Load environment variables
load_dotenv()
# Move API key loading to global scope for application-wide access
steamdt_api_key = os.getenv("STEAMDT_API_KEY")

# 1. 初始化配置
app = Flask(__name__)

# CORS 配置 - 生产环境允许前端域名，开发环境只允许localhost
if os.getenv('FLASK_ENV') == 'production' or os.getenv('RENDER') or os.getenv('RENDER_EXTERNAL_URL'):
    CORS(app, resources={
        r"/api/*": {
            "origins": ["https://singapore-major-bet-frontend.onrender.com"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False
        }
    })
else:
    CORS(app, origins=["http://localhost:3000"], resources={
        r"/api/*": {
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
            "expose_headers": ["Content-Type", "Authorization"],
            "supports_credentials": False
        }
    })

# 配置 SQLite 数据库
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'betting.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 配置 Web3
rpc_url = os.getenv("RPC_URL")
if not rpc_url:
    raise ValueError("RPC_URL not set in .env")

contract_address_str = os.getenv("CONTRACT_ADDRESS")
if not contract_address_str:
    raise ValueError("CONTRACT_ADDRESS not set in .env")

contract_address = Web3.to_checksum_address(contract_address_str)
web3 = Web3(Web3.HTTPProvider(rpc_url))

# 加载 ABI
with open('abi.json', 'r') as f:
    contract_abi = json.load(f)

contract = web3.eth.contract(address=contract_address, abi=contract_abi)

# 配置 Etherscan
etherscan_api_key = os.getenv("ETHERSCAN_API_KEY")
if not etherscan_api_key:
    print("Warning: ETHERSCAN_API_KEY not set, event listening will be limited")
    etherscan_api_key = None

# Etherscan API URLs
ETHERSCAN_BASE_URL = "https://api.etherscan.io/v2/api"  # V2 API for all networks

# 目标方法ID：bet(uint265 _teamId)
TARGET_METHOD_ID = "0x7365870b"

def get_live_dragon_lore_price_usd():
    """
    Fetches the live price of a Dragon Lore from the user's custom API endpoint.
    This version has been cleaned up to reduce excessive logging.
    """
    hash_name = "AWP | Dragon Lore (Factory New)"
    fallback_price_usd = 10000

    try:
        # 1. Construct and call the API
        base_url = "https://buffotte.hezhili.online/api/bufftracker/price/"
        encoded_hash_name = urllib.parse.quote(hash_name)
        full_url = f"{base_url}{encoded_hash_name}"
        response = requests.get(full_url, timeout=10)
        response.raise_for_status()
        data = response.json()

        if not data.get("success") or not data.get("data"):
            raise ValueError("Custom API returned success=false or no data field")

        # 2. Select the best price
        platforms = data["data"]
        price_cny = 0
        preferred_platforms = ["BUFF", "C5", "YOUPIN", "STEAM"]
        
        for platform_name in preferred_platforms:
            platform_data = next((p for p in platforms if p.get("platform") == platform_name and p.get("sellPrice") and p.get("sellCount", 0) > 0), None)
            if platform_data:
                price_cny = platform_data["sellPrice"]
                break
        
        if price_cny == 0:
            # Fallback to any platform if preferred ones are not available
            platform_data = next((p for p in platforms if p.get("sellPrice") and p.get("sellCount", 0) > 0), None)
            if platform_data:
                price_cny = platform_data["sellPrice"]

        if price_cny == 0:
            raise ValueError("No valid sell price found on any platform from custom API")

        # 3. Convert currency and update cache
        rate_response = requests.get("https://api.frankfurter.app/latest?from=CNY&to=USD", timeout=10)
        rate_response.raise_for_status()
        exchange_rate = rate_response.json()["rates"]["USD"]
        
        price_usd = price_cny * exchange_rate
        # --- CLEANED LOG ---
        print(f"✅ Live Dragon Lore price updated: ${price_usd:.2f}")

        with app.app_context():
            weapon = Weapon.query.get(hash_name)
            if weapon:
                weapon.price_usd = price_usd
            else:
                weapon = Weapon(hash_name=hash_name, price_usd=price_usd)
                db.session.add(weapon)
            db.session.commit()
            
        return price_usd

    except Exception as e:
        # --- CLEANED LOG ---
        print(f"❌ Could not fetch live Dragon Lore price: {e}. Using cache/fallback.")
        with app.app_context():
            # FIX: Updated from legacy db.query.get() to db.session.get()
            weapon = db.session.get(Weapon, hash_name)
            if weapon:
                return weapon.price_usd
        return fallback_price_usd

# Pre-defined list of popular CS2 weapon skins
# This list MUST be defined AFTER the functions it calls.
WEAPON_SKINS = [
    {"name": "Dragon Lore (AWP)", "price_func": get_live_dragon_lore_price_usd, "img": "/Dragon Lore (AWP).webp"},
    {"name": "Karambit | Case Hardened (Blue Gem)", "price": 100000, "img": "/skins/karambit_blue_gem.png"},
    {"name": "Howl (M4A4)", "price": 3000, "img": "/skins/howl.png"},
    {"name": "AK-47 | Fire Serpent", "price": 1500, "img": "/skins/fire_serpent.png"},
    {"name": "Gungnir (AWP)", "price": 8000, "img": "/skins/gungnir.png"},
]

# --- 2. 数据库模型 (Models) ---

class Weapon(db.Model):
    """缓存CS2武器价格"""
    hash_name = db.Column(db.String(255), primary_key=True)
    price_usd = db.Column(db.Float, default=0.0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class GameState(db.Model):
    """存储游戏的全局状态"""
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.Integer, default=0) # 0: Open, 1: Stopped, etc.
    total_prize_pool = db.Column(db.String(50), default="0") # 存 Wei (大整数用字符串存)
    winning_team_id = db.Column(db.Integer, nullable=True)


class Team(db.Model):
    """存储战队信息"""
    id = db.Column(db.Integer, primary_key=True) # 对应合约里的 teamId
    name = db.Column(db.String(100))
    total_bet_amount = db.Column(db.String(50), default="0") # Wei
    supporter_count = db.Column(db.Integer, default=0)

class UserBet(db.Model):
    """记录每个用户的下注 - 包含所有Etherscan API字段"""
    id = db.Column(db.Integer, primary_key=True)
    
    # 核心投注信息
    user_address = db.Column(db.String(42))  # from字段
    team_id = db.Column(db.Integer)  # 从input解析
    team_name = db.Column(db.String(100))  # 战队名称
    amount_wei = db.Column(db.String(50))  # value字段
    
    # Etherscan API返回的所有字段
    blockNumber = db.Column(db.String(20))  # 区块号
    blockHash = db.Column(db.String(66))  # 区块哈希
    timeStamp_str = db.Column(db.String(20))  # 时间戳（字符串）
    hash = db.Column(db.String(66))  # 交易哈希
    nonce = db.Column(db.String(20))  # nonce
    transactionIndex = db.Column(db.String(10))  # 交易索引
    to = db.Column(db.String(42))  # 目标地址
    value = db.Column(db.String(50))  # 交易金额
    gas = db.Column(db.String(20))  # gas限制
    gasPrice = db.Column(db.String(20))  # gas价格
    input = db.Column(db.Text)  # 输入数据
    methodId = db.Column(db.String(10))  # 方法ID
    functionName = db.Column(db.String(100))  # 函数名
    contractAddress = db.Column(db.String(42))  # 合约地址
    cumulativeGasUsed = db.Column(db.String(20))  # 累计gas使用
    txreceipt_status = db.Column(db.String(5))  # 交易状态
    gasUsed = db.Column(db.String(20))  # 实际gas使用
    confirmations = db.Column(db.String(10))  # 确认数
    isError = db.Column(db.String(5))  # 是否错误
    
    # 解析后的时间戳（用于排序）
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 唯一约束：使用hash+timeStamp组合确保不重复
    __table_args__ = (db.UniqueConstraint('hash', 'timeStamp_str', name='unique_hash_timestamp'),)

# --- 3. 辅助函数：从链上同步数据 ---

def update_team_stats():
    """更新团队统计数据和总奖池"""
    try:
        # 获取数据库中的统计数据
        from sqlalchemy import func
        team_stats = db.session.query(
            UserBet.team_id,
            func.count(func.distinct(UserBet.user_address)).label('unique_supporters'),
            func.sum(UserBet.amount_wei).label('total_amount_wei')
        ).group_by(UserBet.team_id).all()
        
        # 计算总奖池（所有投注的总和）
        total_prize_pool = db.session.query(func.sum(UserBet.amount_wei)).scalar() or "0"
        
        # 更新GameState表中的总奖池
        game_state = GameState.query.first()
        if game_state:
            game_state.total_prize_pool = str(total_prize_pool)
        
        # 创建team_id到统计数据的映射
        team_stats_dict = {stat.team_id: stat for stat in team_stats}
        
        # 更新现有团队的统计数据
        teams = Team.query.all()
        for team in teams:
            if team.id in team_stats_dict:
                stat = team_stats_dict[team.id]
                team.supporter_count = stat.unique_supporters
                team.total_bet_amount = str(stat.total_amount_wei or "0")
            else:
                team.supporter_count = 0
                team.total_bet_amount = "0"
        
        db.session.commit()
        print(f"✅ Updated stats for {len(teams)} teams, total prize pool: {total_prize_pool} wei")
        return {"message": "Team stats and prize pool updated successfully"}
        
    except Exception as e:
        print(f"❌ Error updating team stats: {e}")
        db.session.rollback()
        return {"error": str(e)}
def sync_data_from_chain():
    """同步数据并更新统计"""
    try:
        # 更新团队统计数据
        update_team_stats()
        
        # 更新游戏状态（如果需要）
        state = GameState.query.first()
        if not state:
            state = GameState(id=1, status=0, total_prize_pool="0", winning_team_id=None)
            db.session.add(state)
            db.session.commit()
        
        return {"message": "Synced successfully"}
    except Exception as e:
        print(f"Sync error: {e}")
        return {"error": str(e)}

# --- 4. 事件监听器：实时同步 ---

def get_contract_transactions_from_etherscan():
    """使用Etherscan API获取合约地址的所有交易记录"""
    if not etherscan_api_key:
        return []
    
    url = f"https://api.etherscan.io/v2/api?apikey={etherscan_api_key}&chainid=11155111&address={contract_address_str}&module=account&action=txlist"
    
    try:
        response = requests.get(url, timeout=15)
        data = response.json()
        
        if data.get('status') == '1':
            return data.get('result', [])
        else:
            message = data.get('message', 'Unknown error')
            if 'No transactions found' in message:
                return []  # 没有交易是正常的，不算错误
            else:
                print(f"Etherscan API error: {message}")
                return []
    except requests.exceptions.Timeout:
        print("Etherscan API request timeout")
        return []
    except Exception as e:
        print(f"Error calling Etherscan API: {e}")
        return []

def setup_event_listeners():
    """设置智能合约事件监听器，实现实时数据同步"""
    
    def event_listener():
        """使用Etherscan API监听合约事件"""
        try:
            # 获取当前最新区块
            latest_block = web3.eth.block_number
            last_checked_block = latest_block - 10  # 从最近10个区块开始
            
            # 用于去重的已处理交易哈希集合
            processed_tx_hashes = set()
            
            while True:
                try:
                    current_block = web3.eth.block_number
                    
                    if current_block > last_checked_block:
                        # 使用Etherscan API获取合约交易记录
                        transactions = get_contract_transactions_from_etherscan()
                        
                        # 处理交易并记录新的下注
                        new_events_count = process_transactions(transactions, processed_tx_hashes)
                        
                        last_checked_block = current_block
                        
                        if new_events_count > 0:
                            print(f"✅ Processed {new_events_count} new events")
                        else:
                            print(f"📋 No new events found")
                        
                        # 限制已处理哈希集合的大小，避免内存泄漏
                        if len(processed_tx_hashes) > 10000:
                            # 保留最近5000个哈希
                            processed_tx_hashes = set(list(processed_tx_hashes)[-5000:])
                    
                    time.sleep(60)  # 每60秒（1分钟）检查一次
                    
                except Exception as e:
                    print(f"Event listener loop error: {e}")
                    time.sleep(30)  # 出错后等待30秒再试
                    
        except Exception as e:
            print(f"Failed to start event listener: {e}")

    # 启动监听线程
    if etherscan_api_key:
        listener_thread = threading.Thread(target=event_listener, daemon=True)
        listener_thread.start()
        print("Etherscan event listener thread started (1 minute intervals)")
    else:
        print("Etherscan API key not configured, skipping event listener")

def process_transactions(transactions, processed_tx_hashes):
    """处理Etherscan API返回的交易列表，记录所有字段到数据库
    
    Args:
        transactions: Etherscan API返回的交易列表
        processed_tx_hashes: 已处理的交易哈希集合，用于去重
    
    Returns:
        int: 新处理的交易数量
    """
    new_bets_count = 0
    
    # 获取当前战队信息，用于team_id到team_name的映射
    try:
        teams_data = contract.functions.getTeams().call()
        team_id_to_name = {team[0]: team[1] for team in teams_data}
    except Exception as e:
        print(f"Error getting teams data: {e}")
        team_id_to_name = {}
    
    for tx in transactions:
        try:
            tx_hash = tx.get('hash', '')
            time_stamp = tx.get('timeStamp', '')
            
            # 使用hash+timeStamp组合进行去重
            dedup_key = f"{tx_hash}_{time_stamp}"
            if dedup_key in processed_tx_hashes:
                continue  # 跳过已处理的交易
            
            # 检查是否是成功的bet交易
            method_id = tx.get('methodId', '')
            tx_status = tx.get('txreceipt_status', '0')  # 1=成功, 0=失败
            
            if method_id == TARGET_METHOD_ID and tx_status == '1':
                # 解析交易输入数据获取team_id
                input_data = tx.get('input', '')
                team_id = 0
                if len(input_data) >= 74:  # 0x + 8字节methodId + 32字节teamId
                    team_id_hex = input_data[10:74]
                    team_id = int(team_id_hex, 16)
                
                # 解析时间戳用于datetime字段
                time_stamp_int = int(tx.get('timeStamp', '0'))
                # FIX: Updated from deprecated utcfromtimestamp to timezone-aware fromtimestamp
                tx_timestamp = datetime.fromtimestamp(time_stamp_int, timezone.utc) if time_stamp_int > 0 else datetime.now(timezone.utc)
                
                # 记录所有API字段到数据库（数据库唯一约束会自动去重）
                with app.app_context():
                    new_bet = UserBet(
                        # 核心投注信息
                        user_address=tx.get('from', ''),
                        team_id=team_id,
                        team_name=team_id_to_name.get(team_id, f'Team {team_id}'),
                        amount_wei=tx.get('value', '0'),
                        
                        # 所有API字段
                        blockNumber=tx.get('blockNumber', ''),
                        blockHash=tx.get('blockHash', ''),
                        timeStamp_str=time_stamp,
                        hash=tx_hash,
                        nonce=tx.get('nonce', ''),
                        transactionIndex=tx.get('transactionIndex', ''),
                        to=tx.get('to', ''),
                        value=tx.get('value', '0'),
                        gas=tx.get('gas', ''),
                        gasPrice=tx.get('gasPrice', ''),
                        input=input_data,
                        methodId=method_id,
                        functionName=tx.get('functionName', ''),
                        contractAddress=tx.get('contractAddress', ''),
                        cumulativeGasUsed=tx.get('cumulativeGasUsed', ''),
                        txreceipt_status=tx_status,
                        gasUsed=tx.get('gasUsed', ''),
                        confirmations=tx.get('confirmations', ''),
                        isError=tx.get('isError', ''),
                        
                        # 解析后的时间戳
                        timestamp=tx_timestamp
                    )
                    
                    try:
                        db.session.add(new_bet)
                        db.session.commit()
                        new_bets_count += 1
                        processed_tx_hashes.add(dedup_key)
                    except Exception as db_error:
                        # 如果是唯一约束冲突，说明已存在，跳过
                        if 'UNIQUE constraint failed' in str(db_error):
                            processed_tx_hashes.add(dedup_key)
                            continue
                        else:
                            raise db_error
                
                # 触发完整同步以更新统计数据
                with app.app_context():
                    sync_result = sync_data_from_chain()
                    print(f"Sync result: {sync_result}")
                    
        except Exception as e:
            print(f"Error processing transaction {tx.get('hash', 'unknown')}: {e}")
    
    return new_bets_count

# --- 5. API 接口 (Routes) ---

@app.route('/api/user_bets/<user_address>', methods=['GET'])
def get_user_bets(user_address):
    """获取用户总下注"""
    bets = UserBet.query.filter_by(user_address=user_address).all()
    total_bet_wei = sum(int(bet.amount_wei) for bet in bets)
    return jsonify({
        "total_bet_wei": str(total_bet_wei),
        "total_bet_eth": float(web3.from_wei(total_bet_wei, 'ether')),
        "bets": [
            {
                "team_id": bet.team_id,
                "amount_wei": bet.amount_wei,
                "amount_eth": float(web3.from_wei(int(bet.amount_wei), 'ether')),
                "timestamp": bet.timestamp.isoformat()
            } for bet in bets
        ]
    })

@app.route('/api/record_bet', methods=['POST'])
def record_bet():
    """记录用户下注"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    user_address = data.get('userAddress')
    team_id = data.get('teamId')
    amount_wei = data.get('amount')
    
    if not all([user_address, team_id, amount_wei]):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        new_bet = UserBet(
            user_address=user_address,
            team_id=int(team_id),
            amount_wei=str(amount_wei)
        )
        db.session.add(new_bet)
        db.session.commit()
        
        # --- FIX: Trigger stats update after recording a new bet ---
        print("🚀 New bet recorded, triggering stats update...")
        update_team_stats()
        # ---------------------------------------------------------
        
        return jsonify({"message": "Bet recorded and stats updated successfully", "bet_id": new_bet.id})
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error recording bet: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/reset_database', methods=['POST'])
def reset_database():
    """清空所有数据库数据（用于更换合约时）"""
    try:
        # 清空所有表
        UserBet.query.delete()
        Team.query.delete()
        GameState.query.delete()
        
        # 重置GameState为初始状态
        initial_state = GameState(id=1, status=0, total_prize_pool="0", winning_team_id=0)
        db.session.add(initial_state)
        
        db.session.commit()
        return jsonify({"message": "Database reset successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/sync_blockchain', methods=['POST'])
def sync_blockchain():
    """手动触发区块链数据同步"""
    try:
        result = sync_data_from_chain()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取当前游戏状态和奖池"""
    state = GameState.query.first()
    if not state:
        return jsonify({
            "status": 0,
            "status_text": "Open",
            "total_prize_pool_wei": "0",
            "winning_team_id": 0
        })
    
    return jsonify({
        "status": state.status, # 0: Open, 1: Stopped...
        "status_text": ["Open", "Stopped", "Finished", "Refunding"][state.status],
        "total_prize_pool_wei": state.total_prize_pool,
        # 方便前端展示，后端也可以简单换算一下 ETH，但建议前端处理精度
        "total_prize_pool_eth": float(web3.from_wei(int(state.total_prize_pool), 'ether')),
        "winning_team_id": state.winning_team_id
    })

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """获取全局统计数据, now with cleaned logging."""
    # 计算总唯一参与者数量
    total_unique_participants = db.session.query(func.count(func.distinct(UserBet.user_address))).scalar()
    
    # 计算总投注数量
    total_bets = UserBet.query.count()
    
    # 计算总奖金池（从GameState获取）
    game_state = GameState.query.first()
    total_prize_pool_wei = game_state.total_prize_pool if game_state else "0"
    total_prize_pool_eth = float(web3.from_wei(int(total_prize_pool_wei), 'ether'))
    
    # Calculate weapon equivalents
    weapon_equivalents = []
    try:
        eth_price_response = requests.get('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT')
        eth_price_response.raise_for_status()
        eth_price_usd = float(eth_price_response.json()['price'])
        total_prize_pool_usd = total_prize_pool_eth * eth_price_usd
        
        # The detailed logging within this loop is now removed.
        for weapon in WEAPON_SKINS:
            price = weapon.get("price")
            if "price_func" in weapon:
                price = weapon["price_func"]() # Call function for dynamic price
            
            if price and price > 0:
                count = int(total_prize_pool_usd / price)
                progress = (total_prize_pool_usd % price) / price * 100
                weapon_equivalents.append({
                    "name": weapon['name'],
                    "count": count,
                    "img": weapon['img'],
                    "price_usd": price,
                    "progress": round(progress, 2)
                })
        
        weapon_equivalents.sort(key=lambda x: x['count'], reverse=True)

    except Exception as e:
        # Error during the broader stats calculation
        print(f"❌ Error in /api/stats weapon calculation: {e}")

    return jsonify({
        "total_unique_participants": total_unique_participants,
        "total_bets": total_bets,
        "total_prize_pool_wei": total_prize_pool_wei,
        "total_prize_pool_eth": total_prize_pool_eth,
        "weapon_equivalents": weapon_equivalents
    })
    
@app.route('/api/leaderboard', methods=['GET'])
def get_leaderboard():
    """获取下注排行榜"""
    try:
        # Cast amount_wei from String to Numeric for safe summation
        top_bettors = db.session.query(
            UserBet.user_address,
            func.sum(cast(UserBet.amount_wei, Numeric)).label('total_amount_wei')
        ).group_by(UserBet.user_address).order_by(func.sum(cast(UserBet.amount_wei, Numeric)).desc()).limit(5).all()
        
        leaderboard = []
        for rank, bettor in enumerate(top_bettors, 1):
            # Ensure total_amount_wei is not None before processing
            total_wei = bettor.total_amount_wei or 0
            leaderboard.append({
                "rank": rank,
                "address": bettor.user_address,
                "total_bet_eth": float(web3.from_wei(int(total_wei), 'ether'))
            })
            
        return jsonify(leaderboard)
    except Exception as e:
        print(f"❌ Error in /api/leaderboard: {e}") # Added logging
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Path to the directory where logos are stored, relative to the backend app.py file
LOGO_DIR_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'teams'))

def get_logo_url(team_name):
    """Find the logo URL for a team by its name, checking for webp, svg, and png."""
    # Sanitize the team name to create a filename (e.g., "Team Spirit" -> "spirit")
    # This is a simple example; you might need more robust logic
    filename = team_name.lower().split(" ")[-1]

    for ext in ['webp', 'svg', 'png']:
        if os.path.exists(os.path.join(LOGO_DIR_PATH, f"{filename}.{ext}")):
            return f"/teams/{filename}.{ext}"
    
    # Fallback for names that might not match the simple split logic
    # (e.g., G2 Esports -> g2)
    if os.path.exists(os.path.join(LOGO_DIR_PATH, f"{team_name.lower().replace(' esports', '')}.webp")):
        return f"/teams/{team_name.lower().replace(' esports', '')}.webp"
    if os.path.exists(os.path.join(LOGO_DIR_PATH, f"{team_name.lower().replace(' esports', '')}.svg")):
        return f"/teams/{team_name.lower().replace(' esports', '')}.svg"

    # Default if no specific logo is found
    return "/teams/default.png"

@app.route('/api/teams', methods=['GET'])
def get_teams():
    """获取所有战队列表及当前赔率数据"""
    teams = Team.query.order_by(Team.id).all()
    result = []
    
    for t in teams:
        result.append({
            "id": t.id,
            "name": t.name,
            "logo_url": get_logo_url(t.name), # Pass team name instead of ID
            "prize_pool_eth": float(web3.from_wei(int(t.total_bet_amount), 'ether')),
            "bets_count": t.supporter_count,
            "is_winner": False # Placeholder, will be updated based on GameState
        })
    
    # Check for a winner and update the is_winner flag
    game_state = GameState.query.first()
    if game_state and game_state.winning_team_id:
        for team in result:
            if team['id'] == game_state.winning_team_id:
                team['is_winner'] = True
                break
    
    return jsonify(result)

# 初始化数据库
with app.app_context():
    db.create_all()
    
    # 初始化团队统计数据
    update_team_stats()

# 启动事件监听器
setup_event_listeners()

if __name__ == '__main__':
    # 生产环境使用gunicorn，开发环境使用flask内置服务器
    if os.getenv('FLASK_ENV') == 'production':
        from gunicorn.app.wsgiapp import WSGIApplication
        WSGIApplication("%(prog)s [OPTIONS] [APP_MODULE]").run()
    else:
        app.run(debug=True, port=int(os.getenv('PORT', 5001)))