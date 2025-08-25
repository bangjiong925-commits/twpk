#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def debug_pk10_table():
    """调试台湾PK10表格结构"""
    
    # 设置Chrome选项
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    try:
        driver = webdriver.Chrome(options=chrome_options)
    except Exception as e:
        print(f"初始化WebDriver失败: {e}")
        return
    
    try:
        print("正在访问网站...")
        driver.get("https://xn--kpro5poukl1g.com/#/")
        
        # 等待页面加载
        wait = WebDriverWait(driver, 10)
        time.sleep(3)
        
        print("页面加载完成")
        
        # 点击台湾PK10选项
        print("\n查找并点击台湾PK10选项...")
        pk10_element = driver.find_element(By.XPATH, "//text()[contains(., '台湾PK10')]/parent::*")
        if pk10_element:
            print(f"找到台湾PK10选项: {pk10_element.text}")
            driver.execute_script("arguments[0].click();", pk10_element)
            time.sleep(3)
            print("成功点击台湾PK10选项")
        
        # 查找所有表格
        print("\n查找表格...")
        tables = driver.find_elements(By.TAG_NAME, "table")
        print(f"找到 {len(tables)} 个表格")
        
        for i, table in enumerate(tables):
            print(f"\n=== 表格 {i+1} ===")
            rows = table.find_elements(By.TAG_NAME, "tr")
            print(f"表格 {i+1} 有 {len(rows)} 行")
            
            for j, row in enumerate(rows[:5]):  # 只显示前5行
                cells = row.find_elements(By.TAG_NAME, "td")
                if not cells:  # 如果没有td，尝试th
                    cells = row.find_elements(By.TAG_NAME, "th")
                
                print(f"  行 {j+1}: {len(cells)} 列")
                
                if cells:
                    cell_texts = []
                    for k, cell in enumerate(cells[:15]):  # 只显示前15列
                        text = cell.text.strip()
                        cell_texts.append(f"[{k+1}]{text}")
                    print(f"    内容: {' | '.join(cell_texts)}")
                    
                    # 如果是数据行（不是表头），详细分析
                    if j > 0 and len(cells) >= 12:
                        print(f"    分析: 时间='{cells[0].text.strip()}', 期号='{cells[1].text.strip()}'")
                        numbers = []
                        for k in range(2, min(12, len(cells))):
                            num_text = cells[k].text.strip()
                            if num_text.isdigit():
                                numbers.append(num_text)
                        print(f"    开奖号码: {numbers} (共{len(numbers)}个)")
        
        # 查找其他可能的数据容器
        print("\n查找其他数据容器...")
        
        # 查找包含数字的div
        divs_with_numbers = driver.find_elements(By.XPATH, "//div[contains(@class, 'table') or contains(@class, 'data') or contains(@class, 'result')]")
        print(f"找到 {len(divs_with_numbers)} 个可能的数据容器")
        
        for i, div in enumerate(divs_with_numbers[:3]):
            print(f"\n数据容器 {i+1}:")
            print(f"  类名: {div.get_attribute('class')}")
            text = div.text.strip()
            if text:
                lines = text.split('\n')[:10]  # 只显示前10行
                for line in lines:
                    if line.strip():
                        print(f"  {line.strip()}")
        
    except Exception as e:
        print(f"发生错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        driver.quit()
        print("\n浏览器已关闭")

if __name__ == "__main__":
    debug_pk10_table()