#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修复数据库中的地址格式问题 - 统一转换为小写"""

from app import app, db, UserVote

def fix_addresses():
    with app.app_context():
        print("🔧 Fixing address formats in database...")
        
        # 获取所有投票记录
        votes = UserVote.query.all()
        print(f"📊 Found {len(votes)} votes in database")
        
        # 显示修复前的地址
        for vote in votes:
            print(f"  Before: {vote.user_address} -> Team {vote.team_id}")
        
        # 统一转换为小写
        fixed_count = 0
        for vote in votes:
            original = vote.user_address
            lowercased = original.lower()
            if original != lowercased:
                vote.user_address = lowercased
                fixed_count += 1
                print(f"  ✅ Fixed: {original} -> {lowercased}")
        
        # 提交更改
        db.session.commit()
        print(f"\n✨ Fixed {fixed_count} addresses to lowercase")
        
        # 验证修复结果
        print("\n📋 Current addresses in database:")
        votes = UserVote.query.all()
        for vote in votes:
            print(f"  {vote.user_address} -> Team {vote.team_id}, Amount: {vote.amount_wei} wei")

if __name__ == '__main__':
    fix_addresses()
