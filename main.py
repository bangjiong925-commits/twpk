#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
台湾PK10数据抓取工具主程序
整合所有模块，提供统一的入口点
"""

import os
import sys
import argparse
import signal
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path

from loguru import logger
from dotenv import load_dotenv

# 导入自定义模块
from python_scraper import TaiwanPK10Scraper
from database_manager import DatabaseManager
from api_client import APIClient
from scheduler import TaskScheduler
from error_handler import (
    ErrorHandler, LoggerConfig, ErrorContext, ErrorType,
    handle_errors, retry_on_error, setup_error_handler
)

# 加载环境变量
load_dotenv()


class ScrapingApplication:
    """抓取应用主类"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or self._load_default_config()
        self.running = False
        
        # 设置错误处理器
        self.error_handler = setup_error_handler(
            LoggerConfig(
                log_dir=self.config.get('log_dir', 'logs'),
                log_level=self.config.get('log_level', 'INFO'),
                retention_days=self.config.get('log_retention_days', 7)
            )
        )
        
        # 初始化组件
        self.scraper = None
        self.db_manager = None
        self.api_client = None
        self.scheduler = None
        
        # 设置信号处理
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        logger.info("台湾PK10抓取应用初始化完成")
    
    def _load_default_config(self) -> Dict[str, Any]:
        """加载默认配置"""
        return {
            'headless': True,
            'max_pages': 5,
            'scraping_interval': 30,  # 分钟
            'cleanup_hour': 2,
            'api_sync_interval': 60,  # 分钟
            'log_dir': 'logs',
            'log_level': 'INFO',
            'log_retention_days': 7,
            'max_retries': 3,
            'timeout': 30,
            'enable_scheduler': True,
            'enable_api_sync': True
        }
    
    def _signal_handler(self, signum, frame):
        """信号处理器"""
        logger.info(f"接收到信号 {signum}，正在停止应用...")
        self.stop()
        sys.exit(0)
    
    @handle_errors(error_type=ErrorType.SYSTEM_ERROR, reraise=True)
    def initialize_components(self) -> bool:
        """初始化所有组件"""
        try:
            with ErrorContext("初始化组件", ErrorType.SYSTEM_ERROR):
                # 初始化抓取器
                self.scraper = TaiwanPK10Scraper(
                    headless=self.config.get('headless', True)
                )
                logger.info("抓取器初始化完成")
                
                # 初始化数据库管理器
                self.db_manager = DatabaseManager()
                if not self.db_manager.connect():
                    raise Exception("数据库连接失败")
                logger.info("数据库管理器初始化完成")
                
                # 初始化API客户端
                if self.config.get('enable_api_sync', True):
                    self.api_client = APIClient(
                        timeout=self.config.get('timeout', 30)
                    )
                    if not self.api_client.test_connection():
                        logger.warning("API连接测试失败，将跳过API同步功能")
                        self.api_client = None
                    else:
                        logger.info("API客户端初始化完成")
                
                # 初始化调度器
                if self.config.get('enable_scheduler', True):
                    self.scheduler = TaskScheduler(use_apscheduler=True)
                    logger.info("调度器初始化完成")
                
                return True
                
        except Exception as e:
            logger.error(f"组件初始化失败: {e}")
            return False
    
    @retry_on_error(max_retries=3, delay=2.0)
    @handle_errors(error_type=ErrorType.SCRAPING_ERROR)
    def run_single_scraping(self, 
                           target_date: Optional[datetime] = None,
                           max_pages: Optional[int] = None) -> Dict[str, Any]:
        """执行单次抓取"""
        if not self.scraper or not self.db_manager:
            raise Exception("组件未初始化")
        
        target_date = target_date or datetime.now()
        max_pages = max_pages or self.config.get('max_pages', 5)
        
        with ErrorContext(f"单次抓取 - {target_date.strftime('%Y-%m-%d')}", ErrorType.SCRAPING_ERROR):
            logger.info(f"开始抓取数据: {target_date.strftime('%Y-%m-%d')}")
            
            # 执行抓取
            scraped_data = self.scraper.run_scraper(
                target_date=target_date,
                max_pages=max_pages
            )
            
            result = {
                'success': False,
                'scraped_count': 0,
                'saved_count': 0,
                'api_synced': False,
                'errors': []
            }
            
            if scraped_data:
                result['scraped_count'] = len(scraped_data)
                logger.info(f"抓取到 {len(scraped_data)} 条数据")
                
                # 保存到数据库
                try:
                    save_result = self.db_manager.save_lottery_data(scraped_data)
                    result['saved_count'] = save_result.get('inserted_count', 0)
                    logger.info(f"保存了 {result['saved_count']} 条新数据")
                except Exception as e:
                    error_msg = f"数据保存失败: {e}"
                    logger.error(error_msg)
                    result['errors'].append(error_msg)
                
                # API同步
                if self.api_client and scraped_data:
                    try:
                        api_success = self.api_client.update_web_data(scraped_data)
                        result['api_synced'] = api_success
                        if api_success:
                            logger.info("API同步成功")
                        else:
                            logger.warning("API同步失败")
                    except Exception as e:
                        error_msg = f"API同步异常: {e}"
                        logger.error(error_msg)
                        result['errors'].append(error_msg)
                
                result['success'] = True
            else:
                logger.warning("未抓取到数据")
                result['errors'].append("未抓取到数据")
            
            return result
    
    def run_scheduled_scraping(self) -> None:
        """运行定时抓取"""
        if not self.scheduler:
            logger.error("调度器未初始化")
            return
        
        try:
            with ErrorContext("定时抓取服务", ErrorType.SYSTEM_ERROR):
                # 添加定时任务
                self.scheduler.add_scraping_job(
                    interval_minutes=self.config.get('scraping_interval', 30)
                )
                
                self.scheduler.add_cleanup_job(
                    hour=self.config.get('cleanup_hour', 2)
                )
                
                if self.api_client:
                    self.scheduler.add_api_sync_job(
                        interval_minutes=self.config.get('api_sync_interval', 60)
                    )
                
                # 启动调度器
                self.running = True
                logger.info("定时抓取服务已启动")
                self.scheduler.start()
                
        except Exception as e:
            logger.error(f"定时抓取服务启动失败: {e}")
            self.error_handler.log_error(e, error_type=ErrorType.SYSTEM_ERROR)
    
    def run_manual_fetch_today(self) -> Dict[str, Any]:
        """手动抓取今日数据"""
        logger.info("开始手动抓取今日数据")
        return self.run_single_scraping(target_date=datetime.now())
    
    def run_historical_scraping(self, 
                               start_date: datetime, 
                               end_date: datetime) -> Dict[str, Any]:
        """抓取历史数据"""
        results = {
            'total_days': 0,
            'successful_days': 0,
            'failed_days': 0,
            'total_records': 0,
            'details': []
        }
        
        current_date = start_date
        while current_date <= end_date:
            try:
                logger.info(f"抓取历史数据: {current_date.strftime('%Y-%m-%d')}")
                
                day_result = self.run_single_scraping(
                    target_date=current_date,
                    max_pages=self.config.get('max_pages', 5)
                )
                
                results['total_days'] += 1
                results['total_records'] += day_result.get('scraped_count', 0)
                
                if day_result.get('success', False):
                    results['successful_days'] += 1
                else:
                    results['failed_days'] += 1
                
                results['details'].append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'result': day_result
                })
                
                # 避免过于频繁的请求
                time.sleep(2)
                
            except Exception as e:
                logger.error(f"抓取 {current_date.strftime('%Y-%m-%d')} 数据失败: {e}")
                results['failed_days'] += 1
                results['details'].append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'result': {'success': False, 'error': str(e)}
                })
            
            current_date += timedelta(days=1)
        
        logger.info(f"历史数据抓取完成: {results}")
        return results
    
    def get_status(self) -> Dict[str, Any]:
        """获取应用状态"""
        status = {
            'running': self.running,
            'components': {
                'scraper': self.scraper is not None,
                'database': self.db_manager is not None and self.db_manager.client is not None,
                'api_client': self.api_client is not None,
                'scheduler': self.scheduler is not None
            },
            'config': self.config,
            'error_stats': self.error_handler.get_error_statistics() if self.error_handler else {}
        }
        
        # 获取数据库统计
        if self.db_manager:
            try:
                status['database_stats'] = self.db_manager.get_statistics()
            except Exception as e:
                status['database_stats'] = {'error': str(e)}
        
        # 获取调度器状态
        if self.scheduler:
            try:
                status['scheduler_status'] = self.scheduler.get_job_status()
            except Exception as e:
                status['scheduler_status'] = {'error': str(e)}
        
        return status
    
    def stop(self) -> None:
        """停止应用"""
        try:
            self.running = False
            logger.info("正在停止应用...")
            
            # 停止调度器
            if self.scheduler:
                self.scheduler.stop()
            
            # 清理资源
            if self.scraper:
                self.scraper.cleanup()
            
            if self.db_manager:
                self.db_manager.close_connection()
            
            if self.api_client:
                self.api_client.close()
            
            # 保存错误报告
            if self.error_handler:
                self.error_handler.save_error_report()
            
            logger.info("应用已停止")
            
        except Exception as e:
            logger.error(f"停止应用时发生错误: {e}")


def create_argument_parser() -> argparse.ArgumentParser:
    """创建命令行参数解析器"""
    parser = argparse.ArgumentParser(
        description='台湾PK10数据抓取工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python main.py --mode single                    # 单次抓取今日数据
  python main.py --mode scheduled                 # 启动定时抓取服务
  python main.py --mode historical --start-date 2024-01-01 --end-date 2024-01-07
  python main.py --mode status                    # 查看状态
        """
    )
    
    parser.add_argument(
        '--mode', 
        choices=['single', 'scheduled', 'historical', 'status'],
        default='single',
        help='运行模式 (默认: single)'
    )
    
    parser.add_argument(
        '--start-date',
        type=str,
        help='历史抓取开始日期 (格式: YYYY-MM-DD)'
    )
    
    parser.add_argument(
        '--end-date',
        type=str,
        help='历史抓取结束日期 (格式: YYYY-MM-DD)'
    )
    
    parser.add_argument(
        '--max-pages',
        type=int,
        default=5,
        help='最大抓取页数 (默认: 5)'
    )
    
    parser.add_argument(
        '--headless',
        action='store_true',
        default=True,
        help='无头模式运行浏览器 (默认: True)'
    )
    
    parser.add_argument(
        '--log-level',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
        default='INFO',
        help='日志级别 (默认: INFO)'
    )
    
    parser.add_argument(
        '--config-file',
        type=str,
        help='配置文件路径'
    )
    
    return parser


def load_config_from_file(config_file: str) -> Dict[str, Any]:
    """从文件加载配置"""
    try:
        import json
        with open(config_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"加载配置文件失败: {e}")
        return {}


def main():
    """主函数"""
    parser = create_argument_parser()
    args = parser.parse_args()
    
    # 加载配置
    config = {}
    if args.config_file:
        config = load_config_from_file(args.config_file)
    
    # 更新配置
    config.update({
        'headless': args.headless,
        'max_pages': args.max_pages,
        'log_level': args.log_level
    })
    
    # 创建应用实例
    app = ScrapingApplication(config)
    
    try:
        # 初始化组件
        if not app.initialize_components():
            logger.error("组件初始化失败，退出程序")
            sys.exit(1)
        
        # 根据模式执行相应操作
        if args.mode == 'single':
            result = app.run_manual_fetch_today()
            print(f"抓取结果: {result}")
            
        elif args.mode == 'scheduled':
            logger.info("启动定时抓取服务...")
            app.run_scheduled_scraping()
            
        elif args.mode == 'historical':
            if not args.start_date or not args.end_date:
                logger.error("历史模式需要指定开始和结束日期")
                sys.exit(1)
            
            try:
                start_date = datetime.strptime(args.start_date, '%Y-%m-%d')
                end_date = datetime.strptime(args.end_date, '%Y-%m-%d')
                
                result = app.run_historical_scraping(start_date, end_date)
                print(f"历史抓取结果: {result}")
                
            except ValueError as e:
                logger.error(f"日期格式错误: {e}")
                sys.exit(1)
                
        elif args.mode == 'status':
            status = app.get_status()
            print(f"应用状态: {status}")
        
    except KeyboardInterrupt:
        logger.info("接收到中断信号")
    except Exception as e:
        logger.error(f"程序执行异常: {e}")
        if app.error_handler:
            app.error_handler.log_error(e, error_type=ErrorType.SYSTEM_ERROR)
    finally:
        app.stop()


if __name__ == "__main__":
    main()