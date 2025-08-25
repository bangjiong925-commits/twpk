#!/usr/bin/env python3
"""
测试表格解析逻辑，验证表头检测功能
"""

import re
from typing import List

def test_header_detection():
    """
    测试表头检测逻辑
    """
    print("=== 测试表头检测逻辑 ===")
    
    # 测试场景1：有表头的表格
    print("\n场景1：有表头的表格")
    table_with_header = [
        ["时间", "期号", "开奖号码"],  # 表头
        ["16:35", "114048023", "3,9,8,1,2,5,4,6,7,10"],
        ["16:30", "114048022", "10,2,4,1,7,8,5,3,6,9"],
        ["16:25", "114048021", "4,5,10,7,6,1,2,8,3,9"]
    ]
    
    start_index = detect_header(table_with_header)
    print(f"检测结果：start_index = {start_index}")
    print(f"应该跳过表头，从第{start_index+1}行开始读取")
    
    # 测试场景2：无表头的表格（第一行就是数据）
    print("\n场景2：无表头的表格")
    table_without_header = [
        ["16:35", "114048023", "3,9,8,1,2,5,4,6,7,10"],
        ["16:30", "114048022", "10,2,4,1,7,8,5,3,6,9"],
        ["16:25", "114048021", "4,5,10,7,6,1,2,8,3,9"],
        ["16:20", "114048020", "9,10,4,2,3,1,7,5,6,8"]
    ]
    
    start_index = detect_header(table_without_header)
    print(f"检测结果：start_index = {start_index}")
    print(f"第一行就是数据，从第{start_index+1}行开始读取")
    
    # 测试场景3：列数不足的表格
    print("\n场景3：列数不足的表格")
    table_insufficient_columns = [
        ["标题"],  # 只有一列
        ["16:35", "114048023", "3,9,8,1,2,5,4,6,7,10"],
        ["16:30", "114048022", "10,2,4,1,7,8,5,3,6,9"]
    ]
    
    start_index = detect_header(table_insufficient_columns)
    print(f"检测结果：start_index = {start_index}")
    print(f"第一行列数不足，从第{start_index+1}行开始读取")
    
    # 验证数据提取
    print("\n=== 验证数据提取 ===")
    for scenario, table_data in [("有表头", table_with_header), ("无表头", table_without_header)]:
        print(f"\n{scenario}场景数据提取：")
        start_index = detect_header(table_data)
        extracted_data = extract_data_from_table(table_data, start_index)
        print(f"提取到 {len(extracted_data)} 条数据")
        for i, data in enumerate(extracted_data[:3]):
            print(f"  {i+1}. 时间: {data['time']}, 期号: {data['period']}, 号码: {data['numbers']}")

def detect_header(table_data: List[List[str]]) -> int:
    """
    检测表头：检查第一行是否包含有效的期号数据
    返回应该开始读取数据的行索引
    """
    start_index = 0
    if len(table_data) > 0:
        first_row = table_data[0]
        if len(first_row) >= 2:
            # 检查第二列是否为数字期号
            period_text = first_row[1].strip()
            if not re.match(r'^\d+$', period_text):
                # 第一行不是有效数据，跳过表头
                start_index = 1
                print(f"检测到表头，第二列内容: '{period_text}'")
            else:
                print(f"第一行包含有效数据，第二列期号: '{period_text}'")
        else:
            # 如果第一行列数不够，可能是表头
            start_index = 1
            print(f"第一行列数不足: {len(first_row)} 列")
    
    return start_index

def extract_data_from_table(table_data: List[List[str]], start_index: int) -> List[dict]:
    """
    从表格数据中提取彩票数据
    """
    extracted_data = []
    
    for row in table_data[start_index:]:
        if len(row) >= 3:
            data = {
                'time': row[0].strip(),
                'period': row[1].strip(),
                'numbers': row[2].strip()
            }
            extracted_data.append(data)
    
    return extracted_data

if __name__ == "__main__":
    test_header_detection()