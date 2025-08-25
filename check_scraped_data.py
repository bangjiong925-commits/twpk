#!/usr/bin/env python3
import json

# 读取最新抓取的数据
with open('taiwan_pk10_latest_scraped.json', 'r', encoding='utf-8') as f:
    json_data = json.load(f)

print(f'抓取时间: {json_data["scrapeTime"]}')
print(f'目标日期: {json_data["targetDate"]}')
print(f'总页数: {json_data["totalPages"]}')
print(f'总记录数: {json_data["totalRecords"]}')
print(f'实际数据页数: {len(json_data["data"])}')

# 统计所有记录
total_records = 0
for page_data in json_data["data"]:
    total_records += len(page_data["records"])
    
print(f'\n实际抓取记录数: {total_records}')

# 显示前5条记录
print('\n前5条数据:')
count = 0
for page_data in json_data["data"]:
    for record in page_data["records"]:
        if count >= 5:
            break
        count += 1
        print(f'{count}. 时间: {record["column_0"]}, 期号: {record["column_1"]}, 号码: {record["formatted"]}')
    if count >= 5:
        break

# 显示最后5条记录
print('\n最后5条数据:')
all_records = []
for page_data in json_data["data"]:
    all_records.extend(page_data["records"])

for i, record in enumerate(all_records[-5:]):
    print(f'{len(all_records)-4+i}. 时间: {record["column_0"]}, 期号: {record["column_1"]}, 号码: {record["formatted"]}')