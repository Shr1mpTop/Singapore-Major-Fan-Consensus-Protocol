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
from datetime import datetime

# 1. 初始化配置
load_dotenv()
app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"]) # 允许前端跨域访问

# 配置 SQLite 数据库
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///betting.db'
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

# 目标方法ID：bet(uint256 _teamId)
TARGET_METHOD_ID = "0x7365870b"

# --- 2. 数据库模型 (Models) ---

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
    """记录每个用户的下注"""
    id = db.Column(db.Integer, primary_key=True)
    user_address = db.Column(db.String(42))  # ETH 地址
    team_id = db.Column(db.Integer)
    amount_wei = db.Column(db.String(50))  # 下注金额 Wei
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# --- 3. 辅助函数：从链上同步数据 ---

def sync_data_from_chain():
    """
    核心逻辑：调用智能合约的 view 函数，更新本地 SQLite。
    在生产环境中，这通常由 Celery 定时任务或后台线程触发。
    """
    if not web3.is_connected():
        return {"error": "Blockchain connection failed"}

    try:
        # 1. 获取全局状态
        current_status = contract.functions.status().call()
        pool_wei = contract.functions.totalPrizePool().call()
        
        # 获取冠军ID (只有在 Finished 状态下才有意义，为了防止报错需try-catch或判断状态)
        winner_id = 0
        if current_status == 2: # Finished
            winner_id = contract.functions.winningTeamId().call()

        # 更新 State 表
        state_record = GameState.query.first()
        if not state_record:
            state_record = GameState(id=1)
            db.session.add(state_record)
        
        state_record.status = current_status
        state_record.total_prize_pool = str(pool_wei)
        state_record.winning_team_id = winner_id

        # 2. 获取战队列表
        # 合约返回: tuple(id, name, totalBetAmount, supporterCount)[]
        teams_data = contract.functions.getTeams().call()

        # 更新 Teams 表
        # 简单粗暴策略：清空旧数据，写入新数据 (适合数据量小的情况)
        # 生产环境建议用 update logic
        Team.query.delete() 
        
        for t in teams_data:
            # t 结构: (id, name, totalBetAmount, supporterCount)
            new_team = Team(
                id=t[0],
                name=t[1],
                total_bet_amount=str(t[2]), # 转字符串存 Wei
                supporter_count=t[3]
            )
            db.session.add(new_team)

        db.session.commit()
        return {"message": "Synced successfully", "status": current_status}

    except Exception as e:
        print(f"Sync Error: {e}")
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
    
    # 获取事件签名
    new_bet_signature = web3.keccak(text="NewBet(address,uint256,uint256)").hex()
    status_change_signature = web3.keccak(text="GameStatusChanged(uint8)").hex()
    winner_selected_signature = web3.keccak(text="WinnerSelected(uint256,string)").hex()
    
    def event_listener():
        """使用Etherscan API监听合约事件"""
        try:
            # 获取当前最新区块
            latest_block = web3.eth.block_number
            last_checked_block = latest_block - 10  # 从最近10个区块开始
            
            # 用于去重的已处理交易哈希集合
            processed_tx_hashes = set()
            
            print(f"Starting Etherscan event listener from block {last_checked_block}")
            
            while True:
                try:
                    current_block = web3.eth.block_number
                    
                    if current_block > last_checked_block:
                        # 使用Etherscan API获取合约交易记录
                        from_block_int = last_checked_block + 1
                        to_block_int = current_block
                        
                        print(f"🔍 Querying all transactions for contract {contract_address_str}")
                        
                        # 获取合约地址的交易记录
                        transactions = get_contract_transactions_from_etherscan()
                        
                        # 处理交易并记录新的下注
                        new_events_count = process_transactions(transactions, processed_tx_hashes)
                        
                        last_checked_block = current_block
                        
                        if new_events_count > 0:
                            print(f"✅ Processed {new_events_count} new events up to block {current_block}")
                        else:
                            print(f"📋 No new events found up to block {current_block}")
                        
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

def handle_new_bet_from_receipt_log(log):
    """从交易收据日志处理新下注事件"""
    try:
        topics = log['topics']
        data = log['data']
        
        # NewBet(address,uint256,uint256) - topics[1]是user地址，topics[2]是teamId，data是amount
        user_address = '0x' + topics[1].hex()[26:]  # 移除前26个字符(0x + 24个0)
        team_id = int(topics[2].hex(), 16)
        amount_wei = str(int(data.hex(), 16))  # data是amount的hex值
        
        print(f"🎯 New bet detected: {user_address} bet {web3.from_wei(int(amount_wei), 'ether')} ETH on team {team_id}")
        
        # 记录用户下注到数据库
        with app.app_context():
            new_bet = UserBet(
                user_address=user_address,
                team_id=team_id,
                amount_wei=amount_wei
            )
            db.session.add(new_bet)
            db.session.commit()
            
            # 触发完整同步以更新统计数据
            sync_result = sync_data_from_chain()
            print(f"Sync result: {sync_result}")
            
    except Exception as e:
        print(f"Error handling NewBet from receipt log: {e}")

def parse_bet_transaction(tx_data):
    """从交易数据中解析下注信息"""
    try:
        # bet函数签名: bet(uint256 _teamId)
        # 函数选择器: 0x7365870b
        # 参数编码: uint256 (32字节)
        
        input_data = tx_data.get('input', '')
        if not input_data or len(input_data) < 10:
            return None
            
        # 移除0x前缀和函数选择器(8字符)
        params_data = input_data[10:]
        
        if len(params_data) >= 64:  # uint256需要32字节=64个十六进制字符
            team_id_hex = params_data[:64]  # 前32字节是teamId
            team_id = int(team_id_hex, 16)
            
            return {
                'user_address': tx_data.get('from', ''),
                'team_id': team_id,
                'amount_wei': str(int(tx_data.get('value', '0'), 16)),
                'tx_hash': tx_data.get('hash', '')
            }
        
        return None
    except Exception as e:
        print(f"Error parsing bet transaction: {e}")
        return None

def process_transactions(transactions, processed_tx_hashes):
    """处理Etherscan API返回的交易列表，解析并存储bet交易
    
    Args:
        transactions: Etherscan API返回的交易列表
        processed_tx_hashes: 已处理的交易哈希集合，用于去重
    
    Returns:
        int: 新处理的交易数量
    """
    new_bets_count = 0
    
    for tx in transactions:
        try:
            tx_hash = tx.get('hash', '')
            if tx_hash in processed_tx_hashes:
                continue  # 跳过已处理的交易
            
            # 检查是否是成功的bet交易
            method_id = tx.get('methodId', '')
            tx_status = tx.get('txreceipt_status', '0')  # 1=成功, 0=失败
            
            if method_id == TARGET_METHOD_ID and tx_status == '1':
                # 解析交易输入数据
                input_data = tx.get('input', '')
                if len(input_data) >= 74:  # 0x + 8字节methodId + 32字节teamId
                    # 提取teamId: input[10:74] (跳过0x和methodId)
                    team_id_hex = input_data[10:74]
                    team_id = int(team_id_hex, 16)
                    
                    # 获取下注金额 (value字段，单位为Wei)
                    amount_wei = tx.get('value', '0')
                    
                    # 获取用户地址
                    user_address = tx.get('from', '')
                    
                    # 获取区块号用于时间戳
                    block_number = int(tx.get('blockNumber', '0'))
                    
                    print(f"🎯 New bet detected: {user_address} bet {web3.from_wei(int(amount_wei), 'ether')} ETH on team {team_id}")
                    
                    # 记录用户下注到数据库
                    with app.app_context():
                        new_bet = UserBet(
                            user_address=user_address,
                            team_id=team_id,
                            amount_wei=amount_wei
                        )
                        db.session.add(new_bet)
                        db.session.commit()
                        
                        # 触发完整同步以更新统计数据
                        sync_result = sync_data_from_chain()
                        print(f"Sync result: {sync_result}")
                    
                    processed_tx_hashes.add(tx_hash)
                    new_bets_count += 1
                    
        except Exception as e:
            print(f"Error processing transaction {tx.get('hash', 'unknown')}: {e}")
    
    return new_bets_count

def handle_status_change_from_receipt_log(log):
    """从交易收据日志处理状态改变事件"""
    try:
        data = log['data']
        new_status = int(data.hex(), 16)
        
        status_names = ["Open", "Stopped", "Finished", "Refunding"]
        status_name = status_names[new_status] if new_status < len(status_names) else f"Unknown({new_status})"
        
        print(f"📢 Game status changed to: {status_name} ({new_status})")
        
        # 更新游戏状态
        with app.app_context():
            sync_data_from_chain()
            
    except Exception as e:
        print(f"Error handling GameStatusChanged from receipt log: {e}")

def handle_winner_selected_from_receipt_log(log):
    """从交易收据日志处理获胜者选择事件"""
    try:
        topics = log['topics']
        data = log['data']
        
        # WinnerSelected(uint256,string) - topics[1]是teamId，data包含teamName
        winner_team_id = int(topics[1].hex(), 16)
        
        # 解析字符串参数（更复杂的解析，这里简化处理）
        # 实际实现需要正确解析ABI编码的字符串
        winner_team_name = f"Team {winner_team_id}"  # 临时简化
        
        print(f"🏆 Winner selected: Team {winner_team_id} - {winner_team_name}")
        
        # 更新获胜者信息
        with app.app_context():
            sync_data_from_chain()
            
    except Exception as e:
        print(f"Error handling WinnerSelected from receipt log: {e}")

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
        return jsonify({"message": "Bet recorded successfully", "bet_id": new_bet.id})
    except Exception as e:
        db.session.rollback()
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
        return jsonify({"status": 0, "total_prize_pool": "0", "winning_team_id": 0})
    
    return jsonify({
        "status": state.status, # 0: Open, 1: Stopped...
        "status_text": ["Open", "Stopped", "Finished", "Refunding"][state.status],
        "total_prize_pool_wei": state.total_prize_pool,
        # 方便前端展示，后端也可以简单换算一下 ETH，但建议前端处理精度
        "total_prize_pool_eth": float(web3.from_wei(int(state.total_prize_pool), 'ether')),
        "winning_team_id": state.winning_team_id
    })

@app.route('/api/teams', methods=['GET'])
def get_teams():
    """获取所有战队列表及当前赔率数据"""
    teams = Team.query.order_by(Team.id).all()
    result = []
    
    for t in teams:
        result.append({
            "id": t.id,
            "name": t.name,
            "total_bet_wei": t.total_bet_amount,
            "total_bet_eth": float(web3.from_wei(int(t.total_bet_amount), 'ether')),
            "supporters": t.supporter_count
        })
    
    return jsonify(result)

# 初始化数据库
with app.app_context():
    db.create_all()

# 启动事件监听器
setup_event_listeners()

if __name__ == '__main__':
    app.run(debug=True, port=5001)