#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台湾PK10数据抓取器 - Python版本
替代原有的auto-scraper.js，实现相同的数据抓取功能
"""

import os
import json
import time
import re
import logging
from datetime import datetime, date
from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass, asdict

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.common.exceptions import TimeoutException, NoSuchElementException, StaleElementReferenceException
from webdriver_manager.chrome import ChromeDriverManager

try:
    from pymongo import MongoClient
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False
    print("警告: pymongo未安装，MongoDB功能将不可用")
    print("请运行: pip install pymongo")

from loguru import logger
import requests
from bs4 import BeautifulSoup


@dataclass
class LotteryData:
    """彩票数据结构"""
    period: str
    draw_numbers: List[int]
    draw_date: datetime
    draw_time: str
    data_source: str = 'python-scraper'
    is_valid: bool = True


class TaiwanPK10Scraper:
    """台湾PK10数据抓取器"""
    
    def __init__(self, headless: bool = True, timeout: int = 30, mongodb_uri: str = "mongodb://localhost:27017", db_name: str = "taiwan_pk10"):
        self.base_url = "https://xn--kpro5poukl1g.com/#/"
        self.timeout = timeout
        self.headless = headless
        self.driver = None
        self.wait = None
        self.scraped_data = []
        self.mongodb_uri = mongodb_uri
        self.db_name = db_name
        self.mongo_client = None
        self.db = None
        
        # 配置日志
        logger.add("logs/scraper_{time}.log", rotation="1 day", retention="7 days")
        
    def setup_driver(self) -> None:
        """设置Chrome浏览器驱动"""
        try:
            chrome_options = Options()
            if self.headless:
                chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
            chrome_options.add_argument('--disable-gpu')
            chrome_options.add_argument('--window-size=1920,1080')
            chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            
            # 自动下载ChromeDriver
            driver_path = ChromeDriverManager().install()
            
            # 修正路径，指向实际的chromedriver可执行文件
            if 'THIRD_PARTY_NOTICES.chromedriver' in driver_path:
                driver_path = driver_path.replace('THIRD_PARTY_NOTICES.chromedriver', 'chromedriver')
            
            service = Service(driver_path)
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            self.wait = WebDriverWait(self.driver, self.timeout)
            
            logger.info("Chrome浏览器驱动设置完成")
            
        except Exception as e:
            logger.error(f"设置浏览器驱动失败: {e}")
            raise
    
    def navigate_to_page(self) -> bool:
        """导航到目标页面"""
        try:
            logger.info(f"正在访问: {self.base_url}")
            self.driver.get(self.base_url)
            
            # 等待页面加载
            self.wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(3)
            
            logger.info("页面加载完成")
            
            # 点击台湾PK10选项
            if self.click_pk10_option():
                logger.info("成功切换到台湾PK10数据")
            else:
                logger.warning("未能切换到台湾PK10数据，使用默认数据")
            
            return True
            
        except TimeoutException:
            logger.error("页面加载超时")
            return False
        except Exception as e:
            logger.error(f"导航到页面失败: {e}")
            return False
    
    def click_pk10_option(self) -> bool:
        """点击台湾PK10选项"""
        try:
            # 查找台湾PK10选项
            pk10_selectors = [
                "//text()[contains(., '台湾PK10')]/parent::*",
                "//span[contains(text(), '台湾PK10')]",
                "//div[contains(text(), '台湾PK10')]",
                "//a[contains(text(), '台湾PK10')]",
                "//button[contains(text(), '台湾PK10')]",
                "//li[contains(text(), '台湾PK10')]",
                "//*[contains(text(), 'PK10')]"
            ]
            
            pk10_element = None
            for selector in pk10_selectors:
                try:
                    elements = self.driver.find_elements(By.XPATH, selector)
                    if elements:
                        for elem in elements:
                            if 'PK10' in elem.text and elem.is_enabled():
                                pk10_element = elem
                                break
                        if pk10_element:
                            break
                except Exception:
                    continue
            
            if pk10_element:
                logger.info(f"找到台湾PK10选项: {pk10_element.text}")
                # 使用JavaScript点击，避免元素被遮挡的问题
                self.driver.execute_script("arguments[0].click();", pk10_element)
                time.sleep(2)
                logger.info("成功点击台湾PK10选项")
                return True
            else:
                logger.warning("未找到台湾PK10选项")
                return False
                
        except Exception as e:
            logger.error(f"点击台湾PK10选项失败: {e}")
            return False
    
    def select_date(self, target_date: datetime) -> bool:
        """选择指定日期"""
        try:
            # 查找日期选择器
            date_selectors = [
                "input[type='date']",
                ".date-picker",
                "#datePicker",
                ".calendar-input"
            ]
            
            date_element = None
            for selector in date_selectors:
                try:
                    date_element = self.driver.find_element(By.CSS_SELECTOR, selector)
                    break
                except NoSuchElementException:
                    continue
            
            if date_element:
                date_str = target_date.strftime('%Y-%m-%d')
                date_element.clear()
                date_element.send_keys(date_str)
                time.sleep(2)
                logger.info(f"已选择日期: {date_str}")
                return True
            else:
                logger.warning("未找到日期选择器，使用默认日期")
                return True
                
        except Exception as e:
            logger.error(f"选择日期失败: {e}")
            return False
    
    def extract_lottery_data(self, page_num: int = 1, max_records: int = None) -> List[LotteryData]:
        """提取彩票数据"""
        data_list = []
        
        try:
            # 查找所有表格，选择包含数据的表格
            tables = self.driver.find_elements(By.TAG_NAME, "table")
            logger.info(f"第{page_num}页找到 {len(tables)} 个表格")
            
            table_element = None
            for i, table in enumerate(tables):
                rows = table.find_elements(By.TAG_NAME, "tr")
                if len(rows) > 10:  # 选择行数较多的表格（包含数据的表格）
                    logger.info(f"第{page_num}页选择表格 {i+1}，包含 {len(rows)} 行")
                    table_element = table
                    break
            
            if not table_element:
                logger.error(f"第{page_num}页未找到包含数据的表格")
                return data_list
            
            # 提取表格行数据
            rows = table_element.find_elements(By.TAG_NAME, "tr")
            logger.info(f"第{page_num}页找到 {len(rows)} 行数据")
            
            # 检测表头：检查第一行是否包含有效的期号数据
            start_index = 0
            if len(rows) > 0:
                first_row_cells = rows[0].find_elements(By.TAG_NAME, "td")
                if len(first_row_cells) >= 2:
                    # 检查第二列是否为数字期号
                    period_text = first_row_cells[1].text.strip()
                    if not re.match(r'^\d+$', period_text):
                        # 第一行不是有效数据，跳过表头
                        start_index = 1
                        logger.info(f"第{page_num}页检测到表头，从第二行开始读取数据")
                    else:
                        logger.info(f"第{page_num}页第一行包含有效数据，从第一行开始读取")
                else:
                    # 如果第一行列数不够，可能是表头
                    start_index = 1
                    logger.info(f"第{page_num}页第一行列数不足，跳过表头")
            
            for row in rows[start_index:]:
                try:
                    # 如果设置了最大记录数且已达到限制，停止处理
                    if max_records is not None and len(data_list) >= max_records:
                        logger.info(f"第{page_num}页已达到最大记录数限制: {max_records}")
                        break
                    
                    cells = row.find_elements(By.TAG_NAME, "td")
                    if len(cells) < 3:  # 台湾PK10需要至少3列：时间、期号、开奖号码
                        continue
                    
                    # 提取开奖时间（第一列）
                    time_text = cells[0].text.strip()
                    draw_date, draw_time = self.parse_draw_time(time_text)
                    
                    # 提取期号（第二列）
                    period = cells[1].text.strip()
                    if not period or not re.match(r'\d+', period):
                        continue
                    
                    # 提取开奖号码（第三列，包含换行分隔的10个数字）
                    numbers_text = cells[2].text.strip()
                    numbers = self.parse_pk10_numbers(numbers_text)
                    
                    if len(numbers) != 10:
                        logger.warning(f"第{page_num}页期号 {period} 的开奖号码数量不正确: {len(numbers)}个数字，原文本: {numbers_text}")
                        continue
                    
                    # 创建数据对象
                    lottery_data = LotteryData(
                        period=period,
                        draw_numbers=numbers,
                        draw_date=draw_date,
                        draw_time=draw_time
                    )
                    
                    data_list.append(lottery_data)
                    
                except Exception as e:
                    logger.warning(f"第{page_num}页解析行数据失败: {e}")
                    continue
            
            logger.info(f"第{page_num}页成功提取 {len(data_list)} 条数据")
            
        except Exception as e:
            logger.error(f"第{page_num}页提取数据失败: {e}")
        
        return data_list
    
    def parse_pk10_numbers(self, numbers_text: str) -> List[int]:
        """解析台湾PK10开奖号码（换行分隔的10个数字）"""
        try:
            # 按换行符分割
            lines = numbers_text.split('\n')
            numbers = []
            
            for line in lines:
                line = line.strip()
                if line.isdigit():
                    numbers.append(int(line))
            
            # 如果换行分割不成功，尝试其他分隔符
            if len(numbers) != 10:
                # 尝试空格分隔
                parts = numbers_text.split()
                numbers = []
                for part in parts:
                    part = part.strip()
                    if part.isdigit():
                        numbers.append(int(part))
            
            # 如果还是不成功，尝试逗号分隔
            if len(numbers) != 10:
                parts = numbers_text.split(',')
                numbers = []
                for part in parts:
                    part = part.strip()
                    if part.isdigit():
                        numbers.append(int(part))
            
            return numbers[:10]  # 确保只返回前10个数字
            
        except Exception as e:
            logger.error(f"解析台湾PK10开奖号码失败: {e}")
            return []
    
    def parse_lottery_numbers(self, numbers_text: str) -> List[int]:
        """解析开奖号码（兼容旧格式）"""
        try:
            # 移除所有非数字字符，保留空格和逗号
            cleaned_text = re.sub(r'[^\d\s,]', '', numbers_text)
            
            # 尝试不同的分隔符
            separators = [',', ' ', '\t']
            
            for sep in separators:
                if sep in cleaned_text:
                    parts = cleaned_text.split(sep)
                    numbers = []
                    for part in parts:
                        part = part.strip()
                        if part.isdigit():
                            numbers.append(int(part))
                    
                    if len(numbers) == 10:
                        return numbers
            
            # 如果没有分隔符，尝试按位分割
            if len(cleaned_text) >= 10:
                numbers = []
                for i in range(0, min(20, len(cleaned_text)), 2):
                    if i + 1 < len(cleaned_text):
                        num_str = cleaned_text[i:i+2]
                        if num_str.isdigit():
                            numbers.append(int(num_str))
                
                if len(numbers) == 10:
                    return numbers
            
            logger.warning(f"无法解析开奖号码: {numbers_text}")
            return []
            
        except Exception as e:
            logger.error(f"解析开奖号码失败: {e}")
            return []
    
    def parse_draw_time(self, time_text: str) -> Tuple[datetime, str]:
        """解析开奖时间"""
        try:
            # 默认使用今天的日期
            today = datetime.now().date()
            
            # 尝试解析时间格式
            time_patterns = [
                r'(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})',
                r'(\d{4}/\d{2}/\d{2})\s+(\d{2}:\d{2}:\d{2})',
                r'(\d{2}:\d{2}:\d{2})',
                r'(\d{2}:\d{2})'
            ]
            
            for pattern in time_patterns:
                match = re.search(pattern, time_text)
                if match:
                    groups = match.groups()
                    
                    if len(groups) == 2:  # 包含日期和时间
                        date_str, time_str = groups
                        try:
                            if '-' in date_str:
                                draw_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                            else:
                                draw_date = datetime.strptime(date_str, '%Y/%m/%d').date()
                        except:
                            draw_date = today
                    else:  # 只有时间
                        time_str = groups[0]
                        draw_date = today
                    
                    return datetime.combine(draw_date, datetime.min.time()), time_str
            
            # 如果无法解析，使用当前时间
            now = datetime.now()
            return now, now.strftime('%H:%M:%S')
            
        except Exception as e:
            logger.error(f"解析开奖时间失败: {e}")
            now = datetime.now()
            return now, now.strftime('%H:%M:%S')
    
    def load_more_data(self) -> bool:
        """加载更多数据"""
        try:
            # 查找加载更多按钮
            load_more_selectors = [
                "button:contains('加载更多')",
                "button:contains('更多')",
                ".load-more",
                "#loadMore",
                "button[onclick*='load']"
            ]
            
            for selector in load_more_selectors:
                try:
                    if ':contains(' in selector:
                        # 使用XPath查找包含文本的按钮
                        xpath = f"//button[contains(text(), '加载更多') or contains(text(), '更多')]" 
                        button = self.driver.find_element(By.XPATH, xpath)
                    else:
                        button = self.driver.find_element(By.CSS_SELECTOR, selector)
                    
                    if button.is_enabled() and button.is_displayed():
                        self.driver.execute_script("arguments[0].click();", button)
                        time.sleep(3)
                        logger.info("已点击加载更多按钮")
                        return True
                        
                except NoSuchElementException:
                    continue
            
            # 尝试滚动到页面底部
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            
            return False
            
        except Exception as e:
            logger.error(f"加载更多数据失败: {e}")
            return False
    
    def navigate_to_next_page(self) -> bool:
        """导航到下一页"""
        try:
            # 获取翻页前的页面内容，用于检测是否真的翻页成功
            try:
                before_content = self.driver.find_element(By.TAG_NAME, "body").text[:500]
            except:
                before_content = ""
            
            # 更全面的下一页按钮选择器
            next_page_selectors = [
                "//a[contains(text(), '下一页')]",
                "//button[contains(text(), '下一页')]",
                "//a[contains(text(), '下页')]",
                "//button[contains(text(), '下页')]",
                "//a[contains(text(), 'Next')]",
                "//button[contains(text(), 'Next')]",
                "//a[contains(@class, 'next')]",
                "//button[contains(@class, 'next')]",
                "//a[contains(@class, 'page-next')]",
                "//button[contains(@class, 'page-next')]",
                "//span[contains(@class, 'next')]/parent::*",
                "//i[contains(@class, 'next')]/parent::*",
                "//a[@aria-label='Next']",
                "//button[@aria-label='Next']",
                "//a[contains(@href, 'page=')]",
                "//div[contains(@class, 'pagination')]//a[last()]",
                "//ul[contains(@class, 'pagination')]//a[last()]"
            ]
            
            # 首先尝试找到并点击下一页按钮
            for xpath in next_page_selectors:
                try:
                    elements = self.driver.find_elements(By.XPATH, xpath)
                    for button in elements:
                        if button.is_enabled() and button.is_displayed():
                            # 检查按钮文本，避免点击"上一页"等按钮
                            button_text = button.text.lower()
                            if any(word in button_text for word in ['上一页', 'prev', 'previous']):
                                continue
                            
                            # 检查按钮是否被禁用（通常表示已经是最后一页）
                            if 'disabled' in button.get_attribute('class') or button.get_attribute('disabled'):
                                logger.info("下一页按钮已禁用，已到达最后一页")
                                return False
                            
                            # 滚动到按钮位置
                            self.driver.execute_script("arguments[0].scrollIntoView(true);", button)
                            time.sleep(1)
                            
                            # 点击按钮
                            self.driver.execute_script("arguments[0].click();", button)
                            time.sleep(3)
                            
                            # 检查页面内容是否发生变化
                            try:
                                after_content = self.driver.find_element(By.TAG_NAME, "body").text[:500]
                                if before_content != after_content:
                                    logger.info(f"已成功翻页: {button.text or button.get_attribute('outerHTML')[:100]}")
                                    return True
                                else:
                                    logger.info("点击翻页按钮后页面内容未变化，可能已到达最后一页")
                                    return False
                            except:
                                # 如果无法检测内容变化，假设翻页成功
                                logger.info(f"已点击翻页按钮: {button.text or button.get_attribute('outerHTML')[:100]}")
                                return True
                        
                except (NoSuchElementException, StaleElementReferenceException):
                    continue
            
            logger.info("没有找到可用的下一页按钮，已到达最后一页")
            return False
            
        except Exception as e:
            logger.error(f"导航到下一页失败: {e}")
            return False
    
    def scrape_all_pages(self, max_pages: int = 5) -> List[LotteryData]:
        """抓取所有页面的数据，最多5页"""
        all_data = []
        page_count = 1
        seen_periods = set()  # 用于去重，记录已见过的期号
        consecutive_empty_pages = 0  # 连续空页面计数
        
        try:
            while page_count <= max_pages:
                logger.info(f"正在抓取第 {page_count} 页数据")
                
                # 提取当前页面数据
                page_data = self.extract_lottery_data(page_count)
                
                if page_data:
                    # 检查数据去重
                    new_data = []
                    duplicate_count = 0
                    
                    for item in page_data:
                        if item.period not in seen_periods:
                            seen_periods.add(item.period)
                            new_data.append(item)
                        else:
                            duplicate_count += 1
                    
                    if new_data:
                        all_data.extend(new_data)
                        logger.info(f"第 {page_count} 页获取到 {len(new_data)} 条新数据")
                        if duplicate_count > 0:
                            logger.info(f"第 {page_count} 页跳过 {duplicate_count} 条重复数据")
                        consecutive_empty_pages = 0
                    else:
                        logger.warning(f"第 {page_count} 页全部为重复数据，可能已到达最后一页")
                        consecutive_empty_pages += 1
                        
                        # 如果连续遇到重复数据页面，说明已经到达最后一页
                        if consecutive_empty_pages >= 2:
                            logger.info("连续遇到重复数据页面，停止抓取")
                            break
                else:
                    logger.warning(f"第 {page_count} 页没有获取到数据")
                    consecutive_empty_pages += 1
                    
                    # 如果连续遇到空页面，说明可能已经到达最后一页
                    if consecutive_empty_pages >= 2:
                        logger.info("连续遇到空页面，停止抓取")
                        break
                
                # 如果已经是最后一页，退出循环
                if page_count >= max_pages:
                    logger.info(f"已达到最大页数 {max_pages}，抓取完成")
                    break
                
                # 尝试导航到下一页
                if not self.navigate_to_next_page():
                    logger.info(f"第 {page_count} 页后没有更多页面，抓取完成")
                    break
                
                page_count += 1
                time.sleep(2)  # 避免请求过快
            
            logger.info(f"总共抓取了 {page_count} 页，获得 {len(all_data)} 条唯一数据")
            
        except Exception as e:
            logger.error(f"抓取所有页面失败: {e}")
        
        return all_data
    
    def save_to_json(self, data: List[LotteryData], filename: str = None) -> str:
        """保存数据到JSON文件"""
        try:
            if not filename:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"taiwan_pk10_data_{timestamp}.json"
            
            # 确保目录存在
            os.makedirs('data', exist_ok=True)
            filepath = os.path.join('data', filename)
            
            # 转换数据为字典格式
            json_data = []
            for item in data:
                json_data.append({
                    'period': item.period,
                    'drawNumbers': item.draw_numbers,
                    'drawDate': item.draw_date.isoformat(),
                    'drawTime': item.draw_time,
                    'dataSource': item.data_source,
                    'isValid': item.is_valid,
                    'scrapedAt': datetime.now().isoformat()
                })
            
            # 保存到文件
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)
            
            # 同时保存为最新数据文件
            latest_filepath = os.path.join('data', 'latest_taiwan_pk10_data.json')
            with open(latest_filepath, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"数据已保存到: {filepath}")
            logger.info(f"最新数据已保存到: {latest_filepath}")
            
            return filepath
            
        except Exception as e:
            logger.error(f"保存数据到JSON失败: {e}")
            return ""
    
    def run_scraper(self, target_date: datetime = None, max_pages: int = 5, save_to_file: bool = True, save_to_db: bool = True) -> List[LotteryData]:
        """运行抓取器主程序"""
        try:
            logger.info("开始运行台湾PK10数据抓取器")
            
            # 设置浏览器驱动
            self.setup_driver()
            
            # 导航到目标页面
            if not self.navigate_to_page():
                logger.error("无法访问目标页面")
                return []
            
            # 选择日期
            if target_date:
                self.select_date(target_date)
            
            # 抓取所有页面数据（最多5页）
            all_data = self.scrape_all_pages(max_pages)
            
            # 数据验证
            valid_data = []
            for item in all_data:
                if item.period and len(item.draw_numbers) == 10 and item.is_valid:
                    valid_data.append(item)
                else:
                    logger.warning(f"数据验证失败: 期号={item.period}, 号码数量={len(item.draw_numbers)}")
            
            logger.info(f"数据验证完成，有效数据: {len(valid_data)}/{len(all_data)} 条")
            
            # 保存数据
            if valid_data:
                # 保存到JSON文件
                if save_to_file:
                    self.save_to_json(valid_data)
                
                # 保存到MongoDB数据库
                if save_to_db:
                    if self.save_to_mongodb(valid_data):
                        logger.info("数据已成功保存到MongoDB数据库")
                        
                        # 显示格式化数据样本
                        formatted_data = self.format_data_for_web(valid_data)
                        if formatted_data:
                            logger.info("格式化数据样本（前5条）:")
                            for i, line in enumerate(formatted_data[:5]):
                                logger.info(f"  {i+1}: {line}")
                            logger.info(f"总计 {len(formatted_data)} 条格式化数据可用于网页导入")
                    else:
                        logger.error("保存到MongoDB失败")
                
                self.scraped_data = valid_data
            
            logger.info(f"抓取完成，共获得 {len(valid_data)} 条有效数据")
            return valid_data
            
        except Exception as e:
            logger.error(f"运行抓取器失败: {e}")
            return []
        
        finally:
            self.cleanup()
    
    def scrape_lottery_data(self, max_pages: int = 5, save_to_file: bool = True, save_to_db: bool = True) -> List[Dict[str, Any]]:
        """抓取彩票数据的新接口，返回字典格式数据"""
        try:
            # 运行抓取器
            lottery_data = self.run_scraper(
                target_date=datetime.now(),
                max_pages=max_pages,
                save_to_file=save_to_file,
                save_to_db=save_to_db
            )
            
            # 转换为字典格式
            result = []
            for item in lottery_data:
                data_dict = {
                    'period_number': item.period,
                    'draw_numbers': ','.join(map(str, item.draw_numbers)),
                    'draw_date': item.draw_date.strftime('%Y-%m-%d') if hasattr(item.draw_date, 'strftime') else str(item.draw_date),
                    'draw_time': item.draw_time,
                    'data_source': item.data_source,
                    'is_valid': item.is_valid,
                    'scraped_at': datetime.now().isoformat()
                }
                result.append(data_dict)
            
            return result
            
        except Exception as e:
            logger.error(f"抓取彩票数据失败: {e}")
            return []
    
    def scrape_latest_single_record(self, save_to_db: bool = True) -> Optional[Dict[str, Any]]:
        """抓取最新一期数据（仅抓取第一页第一条记录）"""
        try:
            logger.info("开始抓取最新一期台湾PK10数据")
            
            # 设置浏览器驱动
            self.setup_driver()
            
            # 导航到目标页面
            if not self.navigate_to_page():
                logger.error("无法访问目标页面")
                return None
            
            # 等待页面加载
            time.sleep(3)
            
            # 抓取第一页第一条数据
            latest_data = self.extract_lottery_data(max_records=1)
            
            if not latest_data:
                logger.warning("未能抓取到最新数据")
                return None
            
            # 获取最新一条记录
            latest_record = latest_data[0]
            
            # 数据验证
            if not (latest_record.period and len(latest_record.draw_numbers) == 10 and latest_record.is_valid):
                logger.warning(f"最新数据验证失败: 期号={latest_record.period}, 号码数量={len(latest_record.draw_numbers)}")
                return None
            
            logger.info(f"成功抓取最新数据: 期号={latest_record.period}")
            
            # 转换为字典格式
            result = {
                'period_number': latest_record.period,
                'draw_numbers': ','.join(map(str, latest_record.draw_numbers)),
                'draw_date': latest_record.draw_date.strftime('%Y-%m-%d') if hasattr(latest_record.draw_date, 'strftime') else str(latest_record.draw_date),
                'draw_time': latest_record.draw_time,
                'data_source': latest_record.data_source,
                'is_valid': latest_record.is_valid,
                'scraped_at': datetime.now().isoformat()
            }
            
            # 保存到数据库
            if save_to_db:
                if self.save_to_mongodb([latest_record]):
                    logger.info("最新数据已保存到MongoDB数据库")
                else:
                    logger.error("保存最新数据到MongoDB失败")
            
            return result
            
        except Exception as e:
            logger.error(f"抓取最新数据失败: {e}")
            return None
        
        finally:
            self.cleanup()
    
    def cleanup(self) -> None:
        """清理资源"""
        try:
            if self.driver:
                self.driver.quit()
                logger.info("浏览器驱动已关闭")
        except Exception as e:
            logger.error(f"清理资源失败: {e}")
    
    def connect_mongodb(self) -> bool:
        """连接MongoDB数据库"""
        if not MONGODB_AVAILABLE:
            logger.error("MongoDB功能不可用，请安装pymongo")
            return False
        
        try:
            self.mongo_client = MongoClient(self.mongodb_uri)
            self.db = self.mongo_client[self.db_name]
            # 测试连接
            self.mongo_client.admin.command('ping')
            logger.info(f"成功连接到MongoDB数据库: {self.db_name}")
            return True
        except Exception as e:
            logger.error(f"连接MongoDB失败: {e}")
            return False
    
    def format_data_for_web(self, data: List[LotteryData]) -> List[str]:
        """格式化数据为网页所需格式: 期号 + 空格 + 开奖号码（逗号分隔）"""
        formatted_data = []
        for item in data:
            if item.is_valid and len(item.draw_numbers) == 10:
                numbers_str = ','.join(map(str, item.draw_numbers))
                formatted_line = f"{item.period} {numbers_str}"
                formatted_data.append(formatted_line)
        return formatted_data
    
    def save_to_mongodb(self, data: List[LotteryData]) -> bool:
        """保存数据到MongoDB数据库"""
        if not self.connect_mongodb():
            return False
        
        try:
            collection = self.db['lottery_data']
            
            # 格式化数据
            formatted_data = self.format_data_for_web(data)
            
            # 准备插入的文档
            documents = []
            for i, item in enumerate(data):
                if item.is_valid and len(item.draw_numbers) == 10:
                    doc = {
                        'period': item.period,
                        'draw_numbers': item.draw_numbers,
                        'draw_date': item.draw_date.isoformat() if hasattr(item.draw_date, 'isoformat') else str(item.draw_date),
                        'draw_time': item.draw_time,
                        'data_source': item.data_source,
                        'formatted_for_web': formatted_data[len(documents)] if len(documents) < len(formatted_data) else f"{item.period} {','.join(map(str, item.draw_numbers))}",
                        'scraped_at': datetime.now(),
                        'is_valid': item.is_valid
                    }
                    documents.append(doc)
            
            if documents:
                # 删除旧数据（可选）
                collection.delete_many({'draw_date': datetime.now().date().isoformat()})
                
                # 插入新数据
                result = collection.insert_many(documents)
                logger.info(f"成功保存 {len(result.inserted_ids)} 条数据到MongoDB")
                
                # 保存格式化数据到单独的集合
                web_collection = self.db['web_formatted_data']
                web_collection.delete_many({'date': datetime.now().date().isoformat()})
                web_doc = {
                    'date': datetime.now().date().isoformat(),
                    'data': formatted_data,
                    'total_records': len(formatted_data),
                    'created_at': datetime.now()
                }
                web_collection.insert_one(web_doc)
                logger.info(f"格式化数据已保存，共 {len(formatted_data)} 条记录")
                
                return True
            else:
                logger.warning("没有有效数据可保存到MongoDB")
                return False
                
        except Exception as e:
            logger.error(f"保存数据到MongoDB失败: {e}")
            return False
        finally:
            if self.mongo_client:
                self.mongo_client.close()
    
    def get_formatted_data_from_db(self) -> List[str]:
        """从数据库获取格式化的数据"""
        if not self.connect_mongodb():
            return []
        
        try:
            web_collection = self.db['web_formatted_data']
            doc = web_collection.find_one(
                {'date': datetime.now().date().isoformat()},
                sort=[('created_at', -1)]
            )
            
            if doc and 'data' in doc:
                logger.info(f"从数据库获取到 {len(doc['data'])} 条格式化数据")
                return doc['data']
            else:
                logger.warning("数据库中没有找到今日的格式化数据")
                return []
                
        except Exception as e:
            logger.error(f"从数据库获取数据失败: {e}")
            return []
        finally:
            if self.mongo_client:
                self.mongo_client.close()


if __name__ == "__main__":
    # 创建抓取器实例
    scraper = TaiwanPK10Scraper(headless=True)
    
    # 运行抓取器，抓取所有5页数据并保存到MongoDB
    data = scraper.run_scraper(target_date=datetime.now(), max_pages=5, save_to_db=True)
    
    print(f"\n=== 抓取结果汇总 ===")
    print(f"总共获得 {len(data)} 条有效数据")
    
    if data:
        # 显示数据统计
        print(f"\n=== 数据统计 ===")
        print(f"第一条数据期号: {data[0].period}")
        print(f"最后一条数据期号: {data[-1].period}")
        print(f"数据时间范围: {data[0].draw_time} - {data[-1].draw_time}")
        
        # 显示格式化数据样本
        formatted_data = scraper.format_data_for_web(data)
        print(f"\n=== 网页格式数据样本 ===")
        for i, line in enumerate(formatted_data[:3]):
            print(f"{i+1}: {line}")
        print(f"...")
        for i, line in enumerate(formatted_data[-2:]):
            print(f"{len(formatted_data)-1+i}: {line}")
        
        print(f"\n格式化数据已准备完成，共 {len(formatted_data)} 条记录可导入网页进行计算")
    else:
        print("未获取到任何数据，请检查网站状态或网络连接")