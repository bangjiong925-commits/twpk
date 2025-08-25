#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能定时抓取调度器
根据最新开奖时间自动计算下一期抓取时间（倒计时75秒）
"""

import time
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import signal
import sys
import json
import os

from python_scraper import TaiwanPK10Scraper
from database_manager import DatabaseManager
from api_client import APIClient

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('auto_scheduler.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AutoScheduler:
    """智能自动抓取调度器"""
    
    def __init__(self):
        self.scraper = TaiwanPK10Scraper()
        self.db_manager = DatabaseManager()
        self.api_client = APIClient()
        
        self.running = False
        self.stop_event = threading.Event()
        self.next_scrape_time = None
        self.last_period_number = None
        
        # 设置信号处理
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        logger.info("智能调度器初始化完成")
    
    def _signal_handler(self, signum, frame):
        """信号处理器"""
        logger.info(f"接收到信号 {signum}，正在停止调度器...")
        self.stop()
        sys.exit(0)
    
    def get_latest_lottery_time(self) -> Optional[Dict[str, Any]]:
        """获取最新一期开奖时间"""
        try:
            # 连接数据库
            if not self.db_manager.connect():
                logger.error("数据库连接失败")
                return None
            
            # 获取最新一期数据
            latest_data = self.db_manager.get_latest_data(days=1, limit=1)
            
            if latest_data and len(latest_data) > 0:
                latest_record = latest_data[0]
                
                # 解析开奖时间
                draw_time_str = f"{latest_record['date']} {latest_record['time']}"
                draw_time = datetime.strptime(draw_time_str, "%Y-%m-%d %H:%M:%S")
                
                return {
                    'period_number': latest_record['period'],
                    'draw_time': draw_time,
                    'draw_numbers': latest_record['numbers']
                }
            
            return None
            
        except Exception as e:
            logger.error(f"获取最新开奖时间失败: {e}")
            return None
        finally:
            self.db_manager.close_connection()
    
    def calculate_next_scrape_time(self, last_draw_time: datetime) -> datetime:
        """计算下一次抓取时间（开奖时间 + 75秒）"""
        next_scrape = last_draw_time + timedelta(seconds=75)
        logger.info(f"最新开奖时间: {last_draw_time}, 下次抓取时间: {next_scrape}")
        return next_scrape
    
    def scrape_latest_data(self) -> Optional[Dict[str, Any]]:
        """抓取最新一期数据"""
        try:
            logger.info("开始抓取最新一期数据")
            
            # 使用抓取器的新方法抓取最新数据
            latest_data = self.scraper.scrape_latest_single_record(save_to_db=False)
            
            if latest_data:
                period_number = latest_data.get('period_number')
                logger.info(f"成功抓取最新数据: 期号={period_number}")
                
                # 检查是否为重复数据
                if self.is_period_exists_in_db(period_number):
                    logger.info(f"期号 {period_number} 已存在于数据库中，跳过保存")
                    return None
                
                return latest_data
            else:
                logger.warning("未能抓取到最新数据")
                return None
                
        except Exception as e:
            logger.error(f"抓取最新数据失败: {e}")
            return None
    
    def is_new_period(self, period_number: str) -> bool:
        """检查是否为新期号"""
        if self.last_period_number is None:
            return True
        
        return period_number != self.last_period_number
    
    def check_for_new_period(self, latest_data: Dict[str, Any]) -> bool:
        """检查是否有新期号数据"""
        try:
            current_period = latest_data.get('period_number')
            if not current_period:
                logger.warning("抓取的数据中没有期号信息")
                return False
            
            # 从数据库获取最新期号
            db_latest = self.get_latest_period_from_db()
            
            if not db_latest:
                logger.info(f"数据库为空，新期号: {current_period}")
                return True
            
            # 比较期号（确保期号为字符串格式进行比较）
            current_period_str = str(current_period)
            db_latest_str = str(db_latest)
            
            if current_period_str != db_latest_str:
                logger.info(f"发现新期号: {current_period_str} (数据库最新: {db_latest_str})")
                return True
            else:
                logger.info(f"期号未更新: {current_period_str}")
                return False
                
        except Exception as e:
            logger.error(f"检查新期号失败: {e}")
            return False
    
    def is_period_exists_in_db(self, period_number: str) -> bool:
        """检查指定期号是否已存在于数据库中"""
        try:
            if not self.db_manager:
                logger.error("数据库管理器未初始化")
                return False
            
            if not self.db_manager.connect():
                logger.error("数据库连接失败")
                return False
            
            if self.db_manager.collection is None:
                logger.error("无法获取数据库集合")
                self.db_manager.close_connection()
                return False
            
            # 查询指定期号是否存在
            query = {"period": str(period_number)}
            existing_record = self.db_manager.collection.find_one(query)
            
            if existing_record:
                logger.info(f"期号 {period_number} 已存在于数据库中")
                self.db_manager.close_connection()
                return True
            else:
                logger.info(f"期号 {period_number} 不存在于数据库中")
                self.db_manager.close_connection()
                return False
                
        except Exception as e:
            logger.error(f"检查期号是否存在失败: {e}")
            self.db_manager.close_connection()
            return False
    
    def get_latest_period_from_db(self) -> Optional[str]:
        """从数据库获取最新期号"""
        try:
            if not self.db_manager:
                logger.error("数据库管理器未初始化")
                return None
            
            if not self.db_manager.connect():
                logger.error("数据库连接失败")
                return None
            
            if self.db_manager.collection is None:
                logger.error("无法获取数据库集合")
                self.db_manager.close_connection()
                return None
            
            # 按期号降序排序，获取最新一条记录
            latest_record = self.db_manager.collection.find().sort("period", -1).limit(1)
            
            for record in latest_record:
                period = record.get('period')
                if period:
                    logger.info(f"数据库最新期号: {period}")
                    self.db_manager.close_connection()
                    return str(period)
            
            logger.info("数据库中没有找到任何记录")
            self.db_manager.close_connection()
            return None
            
        except Exception as e:
            logger.error(f"获取数据库最新期号失败: {e}")
            self.db_manager.close_connection()
            return None
    
    def get_current_collection_name(self) -> str:
        """获取当前应该使用的集合名称（基于日期和数据量）"""
        try:
            current_date = datetime.now().strftime('%Y%m%d')
            
            # 检查当前日期的集合数量
            collection_index = 1
            while True:
                if collection_index == 1:
                    collection_name = f"lottery_data_{current_date}_01"
                else:
                    collection_name = f"lottery_data_{current_date}_{collection_index:02d}"
                
                # 使用新的数据库方法检查集合数据量
                count = self.db_manager.get_collection_count(collection_name)
                
                if count == 0:
                    # 集合不存在或为空，使用它
                    logger.info(f"创建新集合: {collection_name}")
                    return collection_name
                elif count < 1000:
                    # 集合存在且未满，使用它
                    logger.info(f"使用现有集合: {collection_name} (当前数据量: {count}/1000)")
                    return collection_name
                else:
                    # 集合已满，尝试下一个
                    logger.info(f"集合 {collection_name} 已满 ({count}/1000)，尝试下一个")
                    collection_index += 1
                    continue
            
        except Exception as e:
            logger.error(f"获取集合名称时发生错误: {e}")
            # 返回默认集合名称
            return f"lottery_data_{datetime.now().strftime('%Y%m%d')}_01"
    
    def save_new_data(self, data: Dict[str, Any]) -> bool:
        """保存新抓取的数据到数据库（支持分文件存储）"""
        try:
            # 验证数据格式
            if not data or 'period_number' not in data:
                logger.error("数据格式无效")
                return False
            
            period_number = data['period_number']
            
            # 检查是否已存在（在所有相关集合中检查）
            current_date = datetime.now().strftime('%Y%m%d')
            
            # 检查今天的所有集合
            for i in range(1, 100):  # 假设最多99个文件
                collection_name = f"lottery_data_{current_date}_{i:02d}"
                
                # 使用新的数据库方法检查期号是否存在
                if self.db_manager.check_period_exists_in_collection(str(period_number), collection_name):
                    logger.info(f"期号 {period_number} 已存在于集合 {collection_name}，跳过保存")
                    return False
                
                # 如果集合不存在或为空，停止检查
                if self.db_manager.get_collection_count(collection_name) == 0:
                    break
            
            # 转换数据格式
            draw_numbers = data.get('draw_numbers', [])
            if isinstance(draw_numbers, str):
                # 如果是字符串，尝试解析
                try:
                    draw_numbers = json.loads(draw_numbers)
                except:
                    draw_numbers = draw_numbers.split(',') if ',' in draw_numbers else [draw_numbers]
            
            # 确保是数字列表
            numbers_list = []
            for num in draw_numbers:
                try:
                    numbers_list.append(int(str(num).strip()))
                except:
                    logger.warning(f"无法转换数字: {num}")
            
            logger.debug(f"转换后的开奖号码: {numbers_list}")
            
            # 获取当前应该使用的集合名称
            collection_name = self.get_current_collection_name()
            logger.info(f"将数据保存到集合: {collection_name}")
            
            # 创建LotteryData对象
            from python_scraper import LotteryData
            
            lottery_data = LotteryData(
                period=str(period_number),
                draw_numbers=numbers_list,
                draw_date=datetime.strptime(data.get('draw_date', ''), '%Y-%m-%d') if data.get('draw_date') else datetime.now(),
                draw_time=data.get('draw_time', ''),
                data_source=data.get('data_source', 'auto_scraper'),
                is_valid=data.get('is_valid', True)
            )
            
            # 调试输出
            logger.debug(f"准备保存的数据: {lottery_data.__dict__}")
            
            # 保存到指定集合
            result = self.db_manager.save_lottery_data_to_collection([lottery_data], collection_name)
            
            if result and result.get('saved', 0) > 0:
                # 使用新的数据库方法检查集合数据量
                count = self.db_manager.get_collection_count(collection_name)
                logger.info(f"成功保存新数据: 期号 {period_number} 到集合 {collection_name} (当前数据量: {count}/1000)")
                
                if count >= 1000:
                    logger.info(f"集合 {collection_name} 已达到1000条数据上限，下次将创建新集合")
                
                return True
            else:
                logger.error(f"保存数据失败: 期号 {period_number}")
                return False
                
        except Exception as e:
            logger.error(f"保存数据时发生错误: {e}")
            return False
    
    def update_web_display(self, data: Dict[str, Any]) -> bool:
        """更新网页显示最新数据"""
        try:
            period_number = data.get('period_number')
            logger.info(f"开始更新网页显示: 期号={period_number}")
            
            # 1. 更新JSON文件（如果存在的话）
            json_file_path = os.path.join(os.path.dirname(__file__), 'latest_taiwan_pk10_data.json')
            if os.path.exists(json_file_path):
                try:
                    # 读取现有数据
                    with open(json_file_path, 'r', encoding='utf-8') as f:
                        existing_data = json.load(f)
                    
                    # 转换新数据格式
                    # 处理开奖号码：如果是字符串则转换为列表
                    draw_numbers = data.get('draw_numbers', [])
                    if isinstance(draw_numbers, str):
                        numbers_list = [int(x.strip()) for x in draw_numbers.split(',') if x.strip().isdigit()]
                    else:
                        numbers_list = draw_numbers
                    
                    new_record = {
                        'period': str(period_number),
                        'numbers': numbers_list,
                        'date': data.get('draw_date', ''),
                        'time': data.get('draw_time', ''),
                        'source': data.get('data_source', 'auto_scraper'),
                        'is_valid': data.get('is_valid', True),
                        'scraped_at': data.get('scraped_at', datetime.now().isoformat())
                    }
                    
                    # 检查是否已存在该期号
                    period_exists = any(record.get('period') == str(period_number) for record in existing_data)
                    
                    if not period_exists:
                        # 添加到列表开头（最新数据在前）
                        existing_data.insert(0, new_record)
                        
                        # 保持最多1000条记录
                        if len(existing_data) > 1000:
                            existing_data = existing_data[:1000]
                        
                        # 写回文件
                        with open(json_file_path, 'w', encoding='utf-8') as f:
                            json.dump(existing_data, f, ensure_ascii=False, indent=2)
                        
                        logger.info(f"JSON文件更新成功: 添加期号 {period_number}")
                    else:
                        logger.info(f"JSON文件中已存在期号 {period_number}，跳过更新")
                        
                except Exception as e:
                    logger.error(f"更新JSON文件失败: {e}")
                    return False
            else:
                logger.warning(f"JSON文件不存在: {json_file_path}")
            
            # 2. 这里可以添加其他更新网页显示的逻辑
            # 例如：调用API、发送WebSocket消息、更新缓存等
            
            logger.info(f"网页显示更新成功: 期号={period_number}")
            return True
            
        except Exception as e:
            logger.error(f"更新网页显示失败: {e}")
            import traceback
            logger.error(f"错误详情: {traceback.format_exc()}")
            return False
    
    def run_scrape_cycle(self) -> None:
        """执行一次完整的抓取周期"""
        try:
            logger.info("="*50)
            logger.info("开始执行抓取周期...")
            
            # 1. 抓取最新数据
            logger.info("步骤1: 抓取最新数据")
            latest_data = self.scrape_latest_data()
            if not latest_data:
                logger.warning("未获取到最新数据，跳过本次周期")
                return
            
            period_number = latest_data['period_number']
            logger.info(f"抓取到数据: 期号={period_number}")
            
            # 2. 验证数据完整性
            logger.info("步骤2: 验证数据完整性")
            draw_numbers = latest_data.get('draw_numbers')
            logger.info(f"数据验证 - 期号: {period_number}, 开奖号码: {draw_numbers}")
            
            if not period_number or not draw_numbers:
                logger.error(f"数据不完整，跳过保存 - 期号: {period_number}, 开奖号码: {draw_numbers}")
                return
            
            # 3. 保存新数据到数据库
            logger.info("步骤3: 保存新数据到数据库")
            if self.save_new_data(latest_data):
                logger.info(f"新数据保存成功: 期号 {period_number}")
                
                # 4. 更新网页显示
                logger.info("步骤4: 更新网页显示")
                if self.update_web_display(latest_data):
                    logger.info("网页显示更新成功")
                else:
                    logger.warning("网页显示更新失败")
                
                # 5. 更新最后期号
                self.last_period_number = period_number
                
                logger.info(f"✅ 抓取周期完成: 成功处理期号 {period_number}")
            else:
                logger.error(f"❌ 新数据保存失败: 期号={period_number}")
            
        except Exception as e:
            logger.error(f"❌ 执行抓取周期失败: {e}")
            import traceback
            logger.error(f"错误详情: {traceback.format_exc()}")
        finally:
            logger.info("抓取周期结束")
            logger.info("="*50)
    
    def is_within_operating_hours(self) -> bool:
        """检查当前时间是否在运行时间段内（7:05-24:00）"""
        current_time = datetime.now()
        current_hour = current_time.hour
        current_minute = current_time.minute
        
        # 7:05-24:00 运行时间段
        start_time = (7, 5)  # 7:05
        end_time = (24, 0)   # 24:00 (即0:00)
        
        # 当前时间转换为分钟数（从00:00开始计算）
        current_minutes = current_hour * 60 + current_minute
        start_minutes = start_time[0] * 60 + start_time[1]  # 7:05 = 425分钟
        end_minutes = end_time[0] * 60 + end_time[1]        # 24:00 = 1440分钟
        
        # 检查是否在运行时间段内
        if start_minutes <= current_minutes < end_minutes:
            return True
        else:
            return False
    
    def get_next_operating_start_time(self) -> datetime:
        """获取下一个运行开始时间（明天7:05）"""
        current_time = datetime.now()
        tomorrow = current_time + timedelta(days=1)
        next_start = tomorrow.replace(hour=7, minute=5, second=0, microsecond=0)
        return next_start
    
    def start(self) -> None:
        """启动智能调度器"""
        try:
            self.running = True
            logger.info("智能调度器启动中...")
            logger.info("运行时间段: 每天 7:05 - 24:00")
            
            # 获取初始的最新开奖时间
            latest_info = self.get_latest_lottery_time()
            if latest_info:
                self.last_period_number = latest_info['period_number']
                self.next_scrape_time = self.calculate_next_scrape_time(latest_info['draw_time'])
                logger.info(f"初始化完成，当前最新期号: {self.last_period_number}")
            else:
                # 如果没有历史数据，在运行时间段内立即执行一次抓取
                if self.is_within_operating_hours():
                    logger.info("未找到历史数据，立即执行首次抓取")
                    self.run_scrape_cycle()
                    
                    # 重新获取最新时间
                    latest_info = self.get_latest_lottery_time()
                    if latest_info:
                        self.last_period_number = latest_info['period_number']
                        self.next_scrape_time = self.calculate_next_scrape_time(latest_info['draw_time'])
                else:
                    logger.info("当前不在运行时间段内，等待明天7:05开始")
            
            # 主循环
            while self.running and not self.stop_event.is_set():
                current_time = datetime.now()
                
                # 检查是否在运行时间段内
                if not self.is_within_operating_hours():
                    next_start = self.get_next_operating_start_time()
                    wait_seconds = (next_start - current_time).total_seconds()
                    logger.info(f"当前不在运行时间段内，等待 {wait_seconds/3600:.1f} 小时后开始（{next_start.strftime('%Y-%m-%d %H:%M:%S')}）")
                    
                    # 等待到下一个运行时间段，每分钟检查一次
                    while not self.is_within_operating_hours() and self.running and not self.stop_event.is_set():
                        time.sleep(60)  # 每分钟检查一次
                    
                    if self.running and not self.stop_event.is_set():
                        logger.info("进入运行时间段，开始抓取")
                        # 重新获取最新信息
                        latest_info = self.get_latest_lottery_time()
                        if latest_info:
                            self.last_period_number = latest_info['period_number']
                            self.next_scrape_time = self.calculate_next_scrape_time(latest_info['draw_time'])
                    continue
                
                # 在运行时间段内，检查是否到了抓取时间
                if self.next_scrape_time and current_time >= self.next_scrape_time:
                    logger.info(f"到达抓取时间: {self.next_scrape_time}")
                    
                    # 执行抓取周期
                    self.run_scrape_cycle()
                    
                    # 重新计算下次抓取时间
                    latest_info = self.get_latest_lottery_time()
                    if latest_info:
                        self.next_scrape_time = self.calculate_next_scrape_time(latest_info['draw_time'])
                    else:
                        # 如果获取失败，5分钟后重试
                        self.next_scrape_time = current_time + timedelta(minutes=5)
                        logger.warning("获取最新开奖时间失败，5分钟后重试")
                
                # 显示倒计时信息
                if self.next_scrape_time:
                    remaining = (self.next_scrape_time - current_time).total_seconds()
                    if remaining > 0:
                        logger.info(f"距离下次抓取还有 {remaining:.0f} 秒")
                
                # 每10秒检查一次
                time.sleep(10)
            
            logger.info("智能调度器已停止")
            
        except Exception as e:
            logger.error(f"智能调度器运行异常: {e}")
        finally:
            self.cleanup()
    
    def stop(self) -> None:
        """停止调度器"""
        logger.info("正在停止智能调度器...")
        self.running = False
        self.stop_event.set()
    
    def cleanup(self) -> None:
        """清理资源"""
        try:
            self.scraper.cleanup()
            self.db_manager.close_connection()
            logger.info("资源清理完成")
        except Exception as e:
            logger.error(f"资源清理失败: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """获取调度器状态"""
        return {
            'running': self.running,
            'last_period_number': self.last_period_number,
            'next_scrape_time': self.next_scrape_time.isoformat() if self.next_scrape_time else None,
            'current_time': datetime.now().isoformat()
        }


def main():
    """主函数"""
    logger.info("启动智能定时抓取调度器")
    
    scheduler = AutoScheduler()
    
    try:
        scheduler.start()
    except KeyboardInterrupt:
        logger.info("接收到中断信号")
    except Exception as e:
        logger.error(f"调度器异常: {e}")
    finally:
        scheduler.stop()


if __name__ == "__main__":
    main()