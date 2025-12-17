#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Database Reset Script
Used to reset the database when switching contracts or clearing all data
"""

import os
import sys
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from web3 import Web3
import json

# Add backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Initialize Flask app and database
app = Flask(__name__)
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'fan_consensus.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Load contract ABI
with open('abi.json', 'r') as f:
    CONTRACT_ABI = json.load(f)

# Initialize Web3 connection
RPC_URL = os.getenv('RPC_URL')
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS')

if not RPC_URL or not CONTRACT_ADDRESS:
    print("Error: RPC_URL and CONTRACT_ADDRESS environment variables not set")
    sys.exit(1)

web3 = Web3(Web3.HTTPProvider(RPC_URL))
contract = web3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)

# Database model definitions (must match app.py exactly)
class Weapon(db.Model):
    """Cache CS2 weapon prices"""
    hash_name = db.Column(db.String(255), primary_key=True)
    price_usd = db.Column(db.Float, default=0.0)
    last_updated = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

class GameState(db.Model):
    """Store global game state"""
    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.Integer, default=0)
    total_prize_pool = db.Column(db.String(50), default="0")
    winning_team_id = db.Column(db.Integer, nullable=True)

class Team(db.Model):
    """Store team information"""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100))
    total_vote_amount = db.Column(db.String(50), default="0")
    supporter_count = db.Column(db.Integer, default=0)

class UserVote(db.Model):
    """Record each user's vote - includes all Etherscan API fields"""
    id = db.Column(db.Integer, primary_key=True)
    user_address = db.Column(db.String(42))
    team_id = db.Column(db.Integer)
    amount_wei = db.Column(db.String(50))
    block_number = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime)
    hash = db.Column(db.String(66), unique=True)
    # Other Etherscan fields
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

def reset_database():
    """Clear database tables and reinitialize, preserving weapon names"""
    print("=" * 60)
    print("DATABASE RESET SCRIPT")
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
        
        # Clear Weapon data (keep names, clear prices)
        try:
            weapons = Weapon.query.all()
            for weapon in weapons:
                weapon.price_usd = 0.0
                weapon.last_updated = datetime.utcnow()
            print(f"  ✓ Reset {len(weapons)} weapon prices to 0")
        except Exception as e:
            print(f"  ⚠ Error resetting weapons: {e}")
        
        db.session.commit()
        
        # Step 3: Initialize GameState
        print("\n[3/4] Initializing game state...")
        game_state = GameState(
            id=1,
            status=0,
            total_prize_pool="0",
            winning_team_id=None
        )
        db.session.add(game_state)
        db.session.commit()
        print("✓ Game state initialized")
        
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
    print("DATABASE RESET COMPLETE!")
    print("=" * 60)
    print("\nSummary:")
    print(f"  ✓ UserVote: Cleared")
    print(f"  ✓ Team: Cleared and re-synced from contract")
    print(f"  ✓ GameState: Reset to initial state")
    print(f"  ✓ Weapon: Names preserved, prices reset to 0")

    print("Note: Historical transaction data will be synced when the backend starts.")
    print("\nTo start the backend, run:")
    print("  uv run python app.py")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    reset_database()
