#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json

def show_data_stats():
    """显示抓取数据的统计信息"""
    try:
        with open('data/latest_taiwan_pk10_data.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        print(f"\n=== 台湾PK10数据抓取统计 ===")
        print(f"总共抓取了 {len(data)} 条数据")
        print(f"\n最新一期:")
        print(f"  期号: {data[0]['period']}")
        print(f"  开奖时间: {data[0]['drawTime']}")
        print(f"  开奖号码: {data[0]['drawNumbers']}")
        
        print(f"\n最早一期:")
        print(f"  期号: {data[-1]['period']}")
        print(f"  开奖时间: {data[-1]['drawTime']}")
        print(f"  开奖号码: {data[-1]['drawNumbers']}")
        
        print(f"\n数据文件:")
        print(f"  最新数据: data/latest_taiwan_pk10_data.json")
        print(f"  时间戳文件: data/taiwan_pk10_data_20250825_183838.json")
        
        # 验证数据完整性
        valid_count = sum(1 for item in data if len(item['drawNumbers']) == 10)
        print(f"\n数据完整性:")
        print(f"  有效数据: {valid_count}/{len(data)} 条")
        print(f"  数据完整率: {valid_count/len(data)*100:.1f}%")
        
    except Exception as e:
        print(f"读取数据文件失败: {e}")

if __name__ == "__main__":
    show_data_stats()