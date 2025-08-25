#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的抓取测试脚本
用于验证ChromeDriver和抓取功能是否正常工作
"""

import sys
import os
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

def test_simple_scrape():
    """测试简单的网页抓取功能"""
    driver = None
    try:
        print("正在初始化ChromeDriver...")
        
        # 设置Chrome选项
        chrome_options = Options()
        chrome_options.add_argument('--headless')  # 无头模式
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
        
        # 获取ChromeDriver路径
        driver_path = ChromeDriverManager().install()
        
        # 修正路径，指向实际的chromedriver可执行文件
        if 'THIRD_PARTY_NOTICES.chromedriver' in driver_path:
            driver_path = driver_path.replace('THIRD_PARTY_NOTICES.chromedriver', 'chromedriver')
        
        print(f"使用ChromeDriver路径: {driver_path}")
        
        # 创建WebDriver实例
        service = Service(driver_path)
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        print("ChromeDriver初始化成功")
        
        # 测试访问一个简单的网页
        print("正在访问测试网页...")
        driver.get("https://httpbin.org/html")
        
        # 等待页面加载
        time.sleep(2)
        
        # 获取页面标题
        title = driver.title
        print(f"页面标题: {title}")
        
        # 尝试查找页面元素
        try:
            h1_element = driver.find_element(By.TAG_NAME, "h1")
            h1_text = h1_element.text
            print(f"找到H1元素: {h1_text}")
        except Exception as e:
            print(f"查找H1元素失败: {e}")
        
        # 获取页面源码长度
        page_source_length = len(driver.page_source)
        print(f"页面源码长度: {page_source_length} 字符")
        
        print("✅ 简单抓取测试成功!")
        return True
        
    except Exception as e:
        print(f"❌ 抓取测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        if driver:
            try:
                driver.quit()
                print("浏览器已关闭")
            except Exception as e:
                print(f"关闭浏览器时出错: {e}")

if __name__ == "__main__":
    print("开始简单抓取测试...")
    success = test_simple_scrape()
    
    if success:
        print("\n🎉 ChromeDriver配置正确，抓取功能正常!")
        sys.exit(0)
    else:
        print("\n❌ 抓取功能存在问题，需要进一步调试")
        sys.exit(1)