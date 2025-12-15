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

def get_live_weapon_price_usd(hash_name, fallback_price_usd=1000):
    """
    Fetches the live price of any CS2 weapon skin from the user's custom API endpoint.
    This is a generic function that can be used for any weapon skin.
    """
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
        print(f"✅ Live {hash_name} price updated: ${price_usd:.2f}")

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
        print(f"❌ Could not fetch live {hash_name} price: {e}. Using cache/fallback.")
        with app.app_context():
            # FIX: Updated from legacy db.query.get() to db.session.get()
            weapon = db.session.get(Weapon, hash_name)
            if weapon:
                return weapon.price_usd
        return fallback_price_usd

def get_live_dragon_lore_price_usd():
    """
    Fetches the live price of a Dragon Lore from the user's custom API endpoint.
    This function is kept for backward compatibility.
    """
    return get_live_weapon_price_usd("AWP | Dragon Lore (Factory New)", 10000)

# Pre-defined list of popular CS2 weapon skins
# This list MUST be defined AFTER the functions it calls.
# Listed from lowest to highest value, with Dragon Lore as the final milestone
WEAPON_SKINS = [
    {"name": "Tec-9 | Groundwater (Battle-Scarred)", "price_func": lambda: get_live_weapon_price_usd("Tec-9 | Groundwater (Battle-Scarred)", 5), "img": "/skins/Tec-9.webp"},
    {"name": "MAC-10 | Tatter (Well-Worn)", "price_func": lambda: get_live_weapon_price_usd("MAC-10 | Tatter (Well-Worn)", 8), "img": "/skins/MAC-10.webp"},
    {"name": "StatTrak™ Music Kit | TWERL and Ekko & Sidetrack, Under Bright Lights", "price_func": lambda: get_live_weapon_price_usd("StatTrak™ Music Kit | TWERL and Ekko & Sidetrack, Under Bright Lights", 15), "img": "/skins/MusicKit.webp"},
    {"name": "Crasswater The Forgotten | Guerrilla Warfare", "price_func": lambda: get_live_weapon_price_usd("Crasswater The Forgotten | Guerrilla Warfare", 25), "img": "/skins/GuerrillaWarfare.webp"},
    {"name": "Souvenir Galil AR | CAUTION! (Factory New)", "price_func": lambda: get_live_weapon_price_usd("Souvenir Galil AR | CAUTION! (Factory New)", 40), "img": "/skins/Galil.webp"},
    {"name": "M4A4 | Hellish (Minimal Wear)", "price_func": lambda: get_live_weapon_price_usd("M4A4 | Hellish (Minimal Wear)", 80), "img": "/skins/Hellish.webp"},
    {"name": "StatTrak™ AK-47 | Vulcan (Well-Worn)", "price_func": lambda: get_live_weapon_price_usd("StatTrak™ AK-47 | Vulcan (Well-Worn)", 150), "img": "/skins/AK-47.webp"},
    {"name": "★ Sport Gloves | Nocts (Field-Tested)", "price_func": lambda: get_live_weapon_price_usd("★ Sport Gloves | Nocts (Field-Tested)", 300), "img": "/skins/SportGloves.webp"},
    {"name": "★ Karambit | Gamma Doppler (Factory New)", "price_func": lambda: get_live_weapon_price_usd("★ Karambit | Gamma Doppler (Factory New)", 800), "img": "/skins/Karambit.webp"},
    {"name": "★ Butterfly Knife | Crimson Web (Factory New)", "price_func": lambda: get_live_weapon_price_usd("★ Butterfly Knife | Crimson Web (Factory New)", 2000), "img": "/skins/Butterfly.webp"},
    {"name": "AWP | Dragon Lore (Factory New)", "price_func": get_live_dragon_lore_price_usd, "img": "/skins/Dragon.webp"},
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
    with app.app_context():
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

def update_game_status():
    """从智能合约同步游戏状态"""
    with app.app_context():
        try:
            # 从合约获取当前状态
            contract_status = contract.functions.status().call()
            contract_winning_team_id = contract.functions.winningTeamId().call()

            # 更新数据库中的游戏状态
            game_state = GameState.query.first()
            if not game_state:
                game_state = GameState(id=1, status=0, total_prize_pool="0", winning_team_id=None)
                db.session.add(game_state)

            # 更新状态和获胜队伍ID
            old_status = game_state.status
            game_state.status = int(contract_status)
            
            # 只有当游戏状态是Finished或Refunding时，winning_team_id才有意义
            if contract_status in [2, 3]:  # Finished or Refunding
                game_state.winning_team_id = int(contract_winning_team_id)
            else:
                game_state.winning_team_id = None

            # 如果游戏刚刚停止（状态变为Stopped），保存所有用户的投注记录
            if old_status != 1 and contract_status == 1:
                print("🎯 Game stopped! Saving all user bets to database using Etherscan API...")
                save_all_user_bets_to_database()

            db.session.commit()
            print(f"✅ Updated game status: status={contract_status}, winning_team_id={contract_winning_team_id}")
            return {"message": "Game status updated successfully", "status": contract_status, "winning_team_id": contract_winning_team_id}

        except Exception as e:
            print(f"❌ Error updating game status: {e}")
            db.session.rollback()
            return {"error": str(e)}

def sync_data_from_chain():
    """同步数据并更新统计"""
    try:
        # 更新游戏状态从智能合约
        update_game_status()

        # 更新团队统计数据
        update_team_stats()

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

def game_status_sync_worker():
    """后台线程：定期从智能合约同步游戏状态"""
    print("🎯 Game status sync worker started")
    while True:
        try:
            update_game_status()
            time.sleep(30)  # 每30秒同步一次游戏状态
        except Exception as e:
            print(f"Game status sync error: {e}")
            time.sleep(60)  # 出错后等待60秒再试

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

    # 启动监听线程（使用信号量控制并发）
    if etherscan_api_key:
        t = safe_start_thread("EtherscanEventListener", event_listener)
        if t:
            print("Etherscan event listener thread started (1 minute intervals)")
        else:
            print("⚠️ Etherscan event listener not started (semaphore limit)")
    else:
        print("Etherscan API key not configured, skipping event listener")

    # 启动游戏状态同步线程（使用信号量控制并发）
    t2 = safe_start_thread("GameStatusSyncWorker", game_status_sync_worker)
    if t2:
        print("Game status sync thread started (30 second intervals)")
    else:
        print("⚠️ Game status sync thread not started (semaphore limit)")

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

@app.route('/api/withdraw', methods=['POST'])
def withdraw_prize():
    """用户体现奖金或退款"""
    try:
        data = request.get_json()
        user_address = data.get('user_address')
        team_id = data.get('team_id')

        if not user_address or team_id is None:
            return jsonify({"error": "Missing user_address or team_id"}), 400

        # 验证用户地址格式
        try:
            user_address = Web3.to_checksum_address(user_address)
        except:
            return jsonify({"error": "Invalid user address format"}), 400

        # 获取当前状态
        state = GameState.query.first()
        if not state:
            return jsonify({"error": "Game state not found"}), 404

        # 检查游戏状态
        if state.status not in [2, 3]:  # 2: Finished, 3: Refunding
            return jsonify({"error": "Game is not in withdrawal phase"}), 400

        # 检查用户是否有余额
        user_bet = UserBet.query.filter_by(
            user_address=user_address,
            team_id=team_id
        ).first()

        if not user_bet or user_bet.amount_wei == 0:
            return jsonify({"error": "No balance to withdraw for this team"}), 400

        # 构建交易
        nonce = web3.eth.get_transaction_count(user_address)
        gas_price = web3.eth.gas_price

        # withdraw函数的参数
        withdraw_txn = contract.functions.withdraw(team_id).build_transaction({
            'from': user_address,
            'nonce': nonce,
            'gas': 200000,
            'gasPrice': gas_price,
        })

        return jsonify({
            "success": True,
            "transaction": {
                "to": contract_address,
                "data": withdraw_txn['data'],
                "gas": withdraw_txn['gas'],
                "gasPrice": withdraw_txn['gasPrice'],
                "nonce": nonce
            },
            "amount_wei": user_bet.amount_wei,
            "status": "Finished" if state.status == 2 else "Refunding"
        })

    except Exception as e:
        print(f"Withdraw error: {e}")
        return jsonify({"error": str(e)}), 500

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

@app.route('/api/user_betting_history/<user_address>', methods=['GET'])
def get_user_betting_history(user_address):
    """获取用户的投注历史和收益计算"""
    try:
        # 获取用户的所有投注记录
        bets = UserBet.query.filter_by(user_address=user_address).all()
        
        if not bets:
            return jsonify({
                "total_bets": 0,
                "total_invested_eth": 0,
                "total_returned_eth": 0,
                "net_profit_eth": 0,
                "bets": []
            })
        
        # 获取当前游戏状态
        game_state = GameState.query.first()
        if not game_state:
            return jsonify({"error": "Game state not found"}), 404
        
        # 获取所有队伍信息
        teams_data = []
        try:
            contract_teams = contract.functions.getTeams().call()
            for team in contract_teams:
                teams_data.append({
                    "id": team[0],
                    "name": team[1],
                    "total_bet_amount": float(web3.from_wei(team[2], 'ether'))
                })
        except Exception as e:
            print(f"Error getting teams data: {e}")
            teams_data = []
        
        # 计算每个投注的收益
        total_invested = 0
        total_returned = 0
        bet_history = []
        
        for bet in bets:
            bet_amount_eth = float(web3.from_wei(int(bet.amount_wei), 'ether'))
            total_invested += bet_amount_eth
            
            # 查找队伍信息
            team_info = next((t for t in teams_data if t["id"] == bet.team_id), None)
            team_name = team_info["name"] if team_info else f"Team {bet.team_id}"
            
            # 计算收益
            returned_amount = 0
            profit_loss = -bet_amount_eth  # 默认亏损（投注成本）
            status = "Lost"
            
            if game_state.status == 2:  # Finished
                if bet.team_id == game_state.winning_team_id:
                    # 获胜队伍 - 计算奖金
                    if team_info and team_info["total_bet_amount"] > 0:
                        total_prize_pool = float(web3.from_wei(int(game_state.total_prize_pool), 'ether'))
                        distributable_prize = total_prize_pool * 0.9  # 扣除10%公益金
                        returned_amount = (bet_amount_eth / team_info["total_bet_amount"]) * distributable_prize
                        profit_loss = returned_amount - bet_amount_eth
                        status = "Won"
                        total_returned += returned_amount
                    else:
                        status = "Won (No calculation available)"
                else:
                    status = "Lost"
            elif game_state.status == 3:  # Refunding
                # 全额退款
                returned_amount = bet_amount_eth
                profit_loss = 0  # 保本
                status = "Refunded"
                total_returned += returned_amount
            
            bet_history.append({
                "team_id": bet.team_id,
                "team_name": team_name,
                "bet_amount_eth": bet_amount_eth,
                "returned_amount_eth": returned_amount,
                "profit_loss_eth": profit_loss,
                "status": status,
                "timestamp": bet.timestamp.isoformat() if bet.timestamp else None
            })
        
        # 计算净收益
        net_profit = total_returned - total_invested
        
        return jsonify({
            "total_bets": len(bets),
            "total_invested_eth": total_invested,
            "total_returned_eth": total_returned,
            "net_profit_eth": net_profit,
            "game_status": game_state.status,
            "winning_team_id": game_state.winning_team_id,
            "bets": bet_history
        })
        
    except Exception as e:
        print(f"Error getting user betting history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/user_contract_bets/<user_address>', methods=['GET'])
def get_user_contract_bets(user_address):
    """从数据库获取用户的投注历史记录"""
    try:
        # 验证用户地址格式并转换为小写
        try:
            user_address = Web3.to_checksum_address(user_address).lower()
        except:
            return jsonify({"error": "Invalid user address format"}), 400
        
        # 从数据库查询用户的投注历史
        user_bets = UserBet.query.filter_by(user_address=user_address).order_by(UserBet.timestamp.desc()).all()
        
        bets = []
        for bet in user_bets:
            bets.append({
                "team_id": bet.team_id,
                "team_name": bet.team_name,
                "amount_wei": bet.amount_wei,
                "amount_eth": float(web3.from_wei(int(bet.amount_wei), 'ether')),
                "timestamp": bet.timestamp.isoformat() if bet.timestamp else None,
                "tx_hash": bet.hash
            })
        
        return jsonify({"bets": bets})
        
    except Exception as e:
        print(f"Error getting user bets from database: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/historical_team_stats', methods=['GET'])
def get_historical_team_stats():
    """从数据库获取队伍的历史投注统计（用于计算收益，即使合约数据被清除）"""
    try:
        # 从数据库计算每个队伍的总投注金额
        from sqlalchemy import func
        
        team_stats = db.session.query(
            UserBet.team_id,
            UserBet.team_name,
            func.sum(UserBet.amount_wei).label('total_amount_wei')
        ).group_by(UserBet.team_id, UserBet.team_name).all()
        
        teams_data = []
        for team_id, team_name, total_amount_wei in team_stats:
            teams_data.append({
                "id": team_id,
                "name": team_name,
                "prize_pool_eth": float(web3.from_wei(int(total_amount_wei), 'ether')),
                "prize_pool_wei": str(total_amount_wei)
            })
        
        # 按ID排序
        teams_data.sort(key=lambda x: x['id'])
        
        return jsonify({"teams": teams_data})
        
    except Exception as e:
        print(f"Error getting historical team stats: {e}")
        return jsonify({"error": str(e)}), 500

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
    def fetch_eth_price_usd():
        """Try multiple providers with timeouts; fall back to env/static price."""
        price_sources = [
            ("binance", "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT", lambda r: float(r.json()["price"])),
            ("coinbase", "https://api.coinbase.com/v2/prices/ETH-USD/spot", lambda r: float(r.json()["data"]["amount"])),
        ]

        for name, url, parser in price_sources:
            try:
                resp = requests.get(url, timeout=5)
                resp.raise_for_status()
                price = parser(resp)
                if price > 0:
                    return price
            except Exception as exc:
                print(f"⚠️ Fetch {name} price failed: {exc}")

        return float(os.getenv("FALLBACK_ETH_PRICE_USD", "3000"))
    # 计算总唯一参与者数量
    total_unique_participants = db.session.query(func.count(func.distinct(UserBet.user_address))).scalar()
    
    # 计算总投注数量
    total_bets = UserBet.query.count()
    
    # 计算总奖金池（从GameState获取）
    game_state = GameState.query.first()
    total_prize_pool_wei = game_state.total_prize_pool if game_state else "0"
    total_prize_pool_eth = float(web3.from_wei(int(total_prize_pool_wei), 'ether'))
    
    # Calculate weapon equivalents with smart upgrade mechanism
    weapon_equivalents = []
    try:
        eth_price_usd = fetch_eth_price_usd()
        total_prize_pool_usd = total_prize_pool_eth * eth_price_usd
        
        # Calculate each weapon's count and progress
        all_weapons = []
        for weapon in WEAPON_SKINS:
            price = weapon.get("price")
            if "price_func" in weapon:
                price = weapon["price_func"]() # Call function for dynamic price
            
            if price and price > 0:
                raw_count = total_prize_pool_usd / price
                
                # Calculate progress and count based on new requirements
                if raw_count >= 1:
                    # Can buy 1 or more, show 100% progress
                    display_count = int(raw_count)
                    progress = 100.0
                else:
                    # Can't buy even 1, show progress toward buying one
                    display_count = 0
                    progress = round(raw_count * 100, 1)
                
                all_weapons.append({
                    "name": weapon['name'],
                    "count": display_count,
                    "img": weapon['img'],
                    "price_usd": price,
                    "progress": progress,
                    "raw_count": raw_count
                })
        
        weapon_equivalents.extend(all_weapons)

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

def _normalize_team_string(name: str) -> str:
    """Lowercase and collapse separators so case/space differences do not break lookups."""
    return name.lower().replace('-', ' ').replace('_', ' ').strip()

def get_logo_url(team_name):
    """Find the logo URL for a team by its name, checking available files case-insensitively."""
    try:
        available_files = [f for f in os.listdir(LOGO_DIR_PATH) if os.path.isfile(os.path.join(LOGO_DIR_PATH, f))]
    except FileNotFoundError:
        print(f"⚠️ Logo directory not found: {LOGO_DIR_PATH}")
        return "/teams/default.png"

    normalized_files = {
        _normalize_team_string(os.path.splitext(fname)[0]): fname for fname in available_files
    }

    base = _normalize_team_string(team_name)
    candidates = {
        base,
        base.replace(' esports', '').strip(),
        base.replace('  ', ' '),
        ''.join(base.split()),
        base.split(' ')[-1],
    }

    for candidate in candidates:
        if candidate in normalized_files:
            filename = normalized_files[candidate]
            return f"/teams/{quote(filename)}"

    # Default if no specific logo is found; fallback to the first available logo to avoid 404s
    if available_files:
        return f"/teams/{quote(available_files[0])}"
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

# 移除模块级别的线程启动，避免重复创建线程
# setup_event_listeners()  # 移除这一行

def save_all_user_bets_to_database():
    """使用Etherscan API保存所有用户的投注记录到数据库（用于历史记录）"""
    try:
        print("💾 Saving all user bets to database using Etherscan API...")
        
        # 获取Etherscan API的所有交易记录
        transactions = get_contract_transactions_from_etherscan()
        
        if not transactions:
            print("⚠️  No transactions found from Etherscan API")
            return
        
        # 用于去重的已处理交易哈希集合
        processed_tx_hashes = set()
        saved_count = 0
        
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
                    
                    # 检查数据库中是否已存在此记录
                    existing_bet = UserBet.query.filter_by(hash=tx_hash, timeStamp_str=time_stamp).first()
                    if existing_bet:
                        processed_tx_hashes.add(dedup_key)
                        continue  # 已存在，跳过
                    
                    # 记录所有API字段到数据库
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
                            saved_count += 1
                            processed_tx_hashes.add(dedup_key)
                            print(f"  ✅ Saved bet: {tx.get('from', '')[:10]}... -> Team {team_id} ({web3.from_wei(int(tx.get('value', '0')), 'ether')} ETH)")
                        except Exception as db_error:
                            # 如果是唯一约束冲突，说明已存在，跳过
                            if 'UNIQUE constraint failed' in str(db_error):
                                processed_tx_hashes.add(dedup_key)
                                continue
                            else:
                                print(f"  ❌ Database error: {db_error}")
                                db.session.rollback()
                
            except Exception as e:
                print(f"  ❌ Error processing transaction {tx.get('hash', 'unknown')}: {e}")
        
        print(f"✅ Successfully saved {saved_count} betting records to database")
        
    except Exception as e:
        print(f"❌ Error saving user bets to database: {e}")
        import traceback
        traceback.print_exc()

# 全局变量用于跟踪线程是否已启动
threads_started = False

# 信号量配置：限制每个进程中同时运行的后台线程数（可通过环境变量调整）
MAX_BG_THREADS = int(os.getenv("MAX_BG_THREADS", "1"))
bg_thread_semaphore = threading.BoundedSemaphore(MAX_BG_THREADS)
bg_semaphore_lock = threading.Lock()
bg_running_count = 0


def safe_start_thread(name, target, *args, **kwargs):
    """安全启动后台线程：非阻塞获取信号量，启动后在退出时释放信号量并记录日志"""
    acquired = bg_thread_semaphore.acquire(blocking=False)
    if not acquired:
        print(f"⚠️ Skipping starting {name}: max background threads ({MAX_BG_THREADS}) reached")
        return None

    def wrapper(*a, **k):
        global bg_running_count
        with bg_semaphore_lock:
            bg_running_count += 1
            print(f"🔧 {name} started (running={bg_running_count})")

        try:
            target(*a, **k)
        except Exception as e:
            print(f"❌ Exception in {name}: {e}")
            import traceback
            traceback.print_exc()
        finally:
            with bg_semaphore_lock:
                bg_running_count -= 1
                print(f"⛔ {name} exited (running={bg_running_count})")
            try:
                bg_thread_semaphore.release()
            except ValueError:
                print(f"❌ Error releasing semaphore for {name}")

    t = threading.Thread(target=wrapper, args=args, kwargs=kwargs, daemon=True, name=name)
    t.start()
    return t


def start_background_threads():
    """启动后台线程（只执行一次）"""
    global threads_started
    if not threads_started:
        # setup_event_listeners 会使用 safe_start_thread 来启动线程
        setup_event_listeners()
        threads_started = True

# 在第一次请求前启动后台线程（兼容处理）
def initialize_background_threads():
    start_background_threads()

try:
    app.before_first_request(initialize_background_threads)
except AttributeError:
    @app.before_request
    def before_request_hook():
        initialize_background_threads()
except AttributeError:
    # 如果不支持before_first_request，使用before_request但只执行一次
    @app.before_request
    def before_request_hook():
        initialize_background_threads()

# --- 应用启动 ---

if __name__ == '__main__':
    # 在应用启动前初始化事件监听器（开发环境）
    start_background_threads()

    # 生产环境使用gunicorn，开发环境使用flask内置服务器
    if os.getenv('FLASK_ENV') == 'production':
        from gunicorn.app.wsgiapp import WSGIApplication
        WSGIApplication("%(prog)s [OPTIONS] [APP_MODULE]").run()
    else:
        app.run(debug=True, port=int(os.getenv('PORT', 5001)))