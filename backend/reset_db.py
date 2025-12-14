#!/usr/bin/env python3
"""
数据库重置脚本
用于更换合约时清空所有数据
"""

import os
import sys
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

# 添加backend目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 加载环境变量
load_dotenv()

# 初始化Flask应用和数据库
app = Flask(__name__)
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'betting.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 数据库模型定义（与app.py中的相同）
class Weapon(db.Model):
    """缓存CS2武器价格"""
    hash_name = db.Column(db.String(255), primary_key=True)
    price_usd = db.Column(db.Float, default=0.0)
    last_updated = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

class GameState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.Integer, default=0)
    total_prize_pool = db.Column(db.String(50), default="0")
    winning_team_id = db.Column(db.Integer, nullable=True)

class Team(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    total_bet_amount = db.Column(db.String(50), default="0")
    supporter_count = db.Column(db.Integer, default=0)

class UserBet(db.Model):
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
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())
    
    # 唯一约束：使用hash+timeStamp组合确保不重复
    __table_args__ = (db.UniqueConstraint('hash', 'timeStamp_str', name='unique_hash_timestamp'),)

def reset_database():
    """清空数据库并重新初始化"""
    try:
        with app.app_context():
            print("正在清空数据库...")
            db.drop_all() # Drops all tables
            print("所有表格已删除。")
            db.create_all() # Recreates all tables based on current models
            print("所有表格已根据最新模型重建。")

            # Re-initialize GameState
            initial_state = GameState(id=1, status=0, total_prize_pool="0", winning_team_id=None)
            db.session.add(initial_state)

            # Pre-populate with initial teams, ensuring IDs match the blockchain's array index
            teams_to_add = [
                Team(id=0, name='Team Vitality'),
                Team(id=1, name='TYLOO'),
                Team(id=2, name='G2 Esports'),
                Team(id=3, name='FaZe Clan'),
                Team(id=4, name='Natus Vincere'),
                Team(id=5, name='Heroic'),
                Team(id=6, name='ENCE'),
                Team(id=7, name='Team Spirit')
            ]
            db.session.bulk_save_objects(teams_to_add)
            print(f"已添加 {len(teams_to_add)} 个初始战队。")
            
            db.session.commit()
            print("数据库已成功重置和初始化！")

    except Exception as e:
        print(f"数据库重置过程中发生错误: {e}")
        db.session.rollback()

if __name__ == "__main__":
    reset_database()