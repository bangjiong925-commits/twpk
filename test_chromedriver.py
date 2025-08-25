#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试ChromeDriver是否能正常工作
"""

import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def test_chromedriver():
    """测试ChromeDriver"""
    try:
        print("正在测试ChromeDriver...")
        
        # 设置Chrome选项
        chrome_options = Options()
        chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        # 获取ChromeDriver路径
        driver_path = ChromeDriverManager().install()
        print(f"原始路径: {driver_path}")
        
        # 修正路径，指向实际的chromedriver可执行文件
        if 'THIRD_PARTY_NOTICES.chromedriver' in driver_path:
            driver_path = driver_path.replace('THIRD_PARTY_NOTICES.chromedriver', 'chromedriver')
        
        print(f"修正后路径: {driver_path}")
        
        # 检查路径是否存在
        if not os.path.exists(driver_path):
            print(f"错误: ChromeDriver文件不存在: {driver_path}")
            return False
            
        # 检查是否是可执行文件
        if not os.access(driver_path, os.X_OK):
            print(f"错误: ChromeDriver不可执行: {driver_path}")
            return False
        
        # 创建服务
        service = Service(driver_path)
        
        # 创建WebDriver实例
        driver = webdriver.Chrome(service=service, options=chrome_options)
        
        # 测试访问一个简单页面
        driver.get("https://www.google.com")
        title = driver.title
        print(f"页面标题: {title}")
        
        # 关闭浏览器
        driver.quit()
        
        print("ChromeDriver测试成功!")
        return True
        
    except Exception as e:
        print(f"ChromeDriver测试失败: {e}")
        return False

if __name__ == "__main__":
    success = test_chromedriver()
    if success:
        print("\n✅ ChromeDriver配置正确，可以正常使用")
    else:
        print("\n❌ ChromeDriver配置有问题，需要进一步调试")