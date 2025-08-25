#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def find_pk10_option():
    """查找并点击台湾PK10选项"""
    
    # 设置Chrome选项
    chrome_options = Options()
    chrome_options.add_argument('--headless')  # 无头模式
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # 初始化WebDriver
    try:
        # 尝试使用系统中的chromedriver
        driver = webdriver.Chrome(options=chrome_options)
    except Exception as e:
        print(f"使用系统chromedriver失败: {e}")
        # 如果失败，尝试使用ChromeDriverManager
        try:
            service = Service(ChromeDriverManager().install())
            driver = webdriver.Chrome(service=service, options=chrome_options)
        except Exception as e2:
            print(f"使用ChromeDriverManager也失败: {e2}")
            raise e2
    
    try:
        print("正在访问网站...")
        driver.get("https://xn--kpro5poukl1g.com/#/")
        
        # 等待页面加载
        wait = WebDriverWait(driver, 10)
        time.sleep(3)
        
        print("页面标题:", driver.title)
        print("当前URL:", driver.current_url)
        
        # 查找台湾PK10选项
        print("\n查找台湾PK10选项...")
        
        # 尝试多种方式查找台湾PK10选项
        pk10_selectors = [
            "//text()[contains(., '台湾PK10')]/parent::*",
            "//span[contains(text(), '台湾PK10')]",
            "//div[contains(text(), '台湾PK10')]",
            "//a[contains(text(), '台湾PK10')]",
            "//button[contains(text(), '台湾PK10')]",
            "//li[contains(text(), '台湾PK10')]",
            "//td[contains(text(), '台湾PK10')]",
            "//th[contains(text(), '台湾PK10')]",
            "//*[contains(text(), 'PK10')]",
            "//*[contains(text(), 'pk10')]"
        ]
        
        pk10_element = None
        for selector in pk10_selectors:
            try:
                elements = driver.find_elements(By.XPATH, selector)
                if elements:
                    print(f"找到 {len(elements)} 个匹配元素: {selector}")
                    for i, elem in enumerate(elements):
                        print(f"  元素 {i+1}: {elem.tag_name}, 文本: '{elem.text}', 可点击: {elem.is_enabled()}")
                        if 'PK10' in elem.text or 'pk10' in elem.text.lower():
                            pk10_element = elem
                            break
                    if pk10_element:
                        break
            except Exception as e:
                print(f"选择器 {selector} 出错: {e}")
        
        if pk10_element:
            print(f"\n找到台湾PK10选项: {pk10_element.text}")
            print(f"元素标签: {pk10_element.tag_name}")
            print(f"元素类名: {pk10_element.get_attribute('class')}")
            print(f"元素ID: {pk10_element.get_attribute('id')}")
            
            # 尝试点击
            try:
                print("\n尝试点击台湾PK10选项...")
                driver.execute_script("arguments[0].click();", pk10_element)
                time.sleep(2)
                print("点击成功!")
                
                # 检查页面变化
                print("\n点击后的页面信息:")
                print("当前URL:", driver.current_url)
                
                # 再次查找表格数据
                tables = driver.find_elements(By.TAG_NAME, "table")
                print(f"找到 {len(tables)} 个表格")
                
                if tables:
                    for i, table in enumerate(tables[:2]):  # 只检查前2个表格
                        print(f"\n表格 {i+1} 内容片段:")
                        print(table.text[:200] + "..." if len(table.text) > 200 else table.text)
                        
            except Exception as e:
                print(f"点击失败: {e}")
        else:
            print("\n未找到台湾PK10选项")
            
            # 显示页面上所有可能的选项
            print("\n页面上的所有文本内容:")
            body_text = driver.find_element(By.TAG_NAME, "body").text
            lines = body_text.split('\n')
            for line in lines:
                if line.strip() and ('台湾' in line or 'PK' in line or '五分彩' in line):
                    print(f"  - {line.strip()}")
        
    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        driver.quit()
        print("\n浏览器已关闭")

if __name__ == "__main__":
    find_pk10_option()