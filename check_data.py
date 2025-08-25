#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from database_manager import DatabaseManager
from datetime import datetime

def check_database_data():
    """检查数据库中的数据"""
    db = DatabaseManager()
    
    try:
        # 连接数据库
        db.connect()
        print("✅ 数据库连接成功")
        
        # 获取统计信息
        stats = db.get_statistics()
        print(f"📊 数据库统计信息: {stats}")
        
        # 获取最近的记录
        if db.collection is not None:
            total_count = db.collection.count_documents({})
            print(f"📈 总记录数: {total_count}")
            
            if total_count > 0:
                # 获取最近10条记录
                recent_records = list(db.collection.find().limit(10).sort("timestamp", -1))
                print(f"\n🔍 最近 {len(recent_records)} 条记录:")
                
                for i, record in enumerate(recent_records[:5], 1):
                    issue = record.get("issue", "N/A")
                    timestamp = record.get("timestamp", "N/A")
                    numbers = record.get("numbers", "N/A")
                    print(f"  {i}. 期号: {issue}, 时间: {timestamp}, 号码: {numbers}")
                
                # 检查今天的数据
                today = datetime.now().strftime("%Y-%m-%d")
                today_filter = {"timestamp": {"$regex": f"^{today}"}}
                today_count = db.collection.count_documents(today_filter)
                print(f"\n📅 今天({today})的记录数: {today_count}")
                
                if today_count > 0:
                    today_records = list(db.collection.find(today_filter).sort("timestamp", -1))
                    print("\n🎯 今天的数据:")
                    for i, record in enumerate(today_records, 1):
                        issue = record.get("issue", "N/A")
                        timestamp = record.get("timestamp", "N/A")
                        numbers = record.get("numbers", "N/A")
                        print(f"  {i}. 期号: {issue}, 时间: {timestamp}, 号码: {numbers}")
                else:
                    print("❌ 今天没有数据")
            else:
                print("❌ 数据库中没有任何记录")
        else:
            print("❌ 数据库集合未初始化")
            
    except Exception as e:
        print(f"❌ 检查数据库时出错: {e}")
    finally:
        db.close_connection()
        print("\n🔚 数据库连接已关闭")

if __name__ == "__main__":
    check_database_data()