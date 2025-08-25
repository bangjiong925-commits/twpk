#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试新的台湾宾果开奖网站
"""

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def test_new_site():
    """测试新网站的页面结构"""
    
    # 设置Chrome选项
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    try:
        # 设置驱动
        driver_path = ChromeDriverManager().install()
        if 'THIRD_PARTY_NOTICES.chromedriver' in driver_path:
            driver_path = driver_path.replace('THIRD_PARTY_NOTICES.chromedriver', 'chromedriver')
        
        service = Service(driver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        wait = WebDriverWait(driver, 30)
        
        print("正在访问新网站...")
        driver.get("https://xn--kpro5poukl1g.com/#/")
        
        # 等待页面加载
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(5)  # 额外等待时间让JavaScript渲染
        
        print(f"页面标题: {driver.title}")
        print(f"当前URL: {driver.current_url}")
        
        # 获取页面源码的前1000个字符
        page_source = driver.page_source
        print(f"页面源码长度: {len(page_source)}")
        print("页面源码片段:")
        print(page_source[:1000])
        print("\n" + "="*50 + "\n")
        
        # 查找可能的表格元素
        table_selectors = [
            "table",
            ".lottery-table",
            ".data-table", 
            "#lotteryTable",
            ".result-table",
            ".table",
            "[class*='table']",
            "[class*='result']",
            "[class*='lottery']",
            "[class*='data']"
        ]
        
        print("查找表格元素:")
        for selector in table_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"找到 {len(elements)} 个元素匹配选择器: {selector}")
                    for i, elem in enumerate(elements[:3]):  # 只显示前3个
                        print(f"  元素 {i+1}: {elem.tag_name}, 文本长度: {len(elem.text)}, 文本片段: {elem.text[:100]}")
            except Exception as e:
                print(f"选择器 {selector} 出错: {e}")
        
        # 查找所有可见的文本内容
        print("\n查找页面中的所有文本内容:")
        body = driver.find_element(By.TAG_NAME, "body")
        body_text = body.text
        print(f"页面文本长度: {len(body_text)}")
        if body_text:
            print("页面文本片段:")
            print(body_text[:500])
        
        # 查找可能包含数据的div元素
        print("\n查找可能的数据容器:")
        data_selectors = [
            "div[class*='result']",
            "div[class*='lottery']", 
            "div[class*='data']",
            "div[class*='number']",
            "div[class*='draw']",
            "ul", "li"
        ]
        
        for selector in data_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    print(f"找到 {len(elements)} 个元素匹配选择器: {selector}")
                    for i, elem in enumerate(elements[:2]):  # 只显示前2个
                        if elem.text.strip():
                            print(f"  元素 {i+1}: {elem.text[:100]}")
            except Exception as e:
                print(f"选择器 {selector} 出错: {e}")
        
    except Exception as e:
        print(f"测试失败: {e}")
    
    finally:
        try:
            driver.quit()
        except:
            pass

if __name__ == "__main__":
    test_new_site()