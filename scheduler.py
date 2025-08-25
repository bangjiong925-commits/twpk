#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
定时任务调度器
管理台湾PK10数据抓取的定时任务
"""

import os
import time
import signal
import sys
from datetime import datetime, timedelta
from typing import Optional, Callable, Dict, Any
from threading import Thread, Event

import schedule
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore
from loguru import logger
from dotenv import load_dotenv

from python_scraper import TaiwanPK10Scraper
from database_manager import DatabaseManager
from api_client import APIClient

# 加载环境变量
load_dotenv()


class TaskScheduler:
    """定时任务调度器"""
    
    def __init__(self, use_apscheduler: bool = True):
        self.use_apscheduler = use_apscheduler
        self.scheduler = None
        self.running = False
        self.stop_event = Event()
        
        # 初始化组件
        self.scraper = TaiwanPK10Scraper(headless=True)
        self.db_manager = DatabaseManager()
        self.api_client = APIClient()
        
        # 配置日志
        logger.add("logs/scheduler_{time}.log", rotation="1 day", retention="7 days")
        
        # 设置信号处理
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        self._setup_scheduler()
    
    def _setup_scheduler(self) -> None:
        """设置调度器"""
        if self.use_apscheduler:
            # 使用APScheduler
            jobstores = {
                'default': MemoryJobStore()
            }
            
            executors = {
                'default': ThreadPoolExecutor(max_workers=3)
            }
            
            job_defaults = {
                'coalesce': True,
                'max_instances': 1,
                'misfire_grace_time': 300  # 5分钟容错时间
            }
            
            self.scheduler = BackgroundScheduler(
                jobstores=jobstores,
                executors=executors,
                job_defaults=job_defaults,
                timezone='Asia/Shanghai'
            )
        else:
            # 使用schedule库
            self.scheduler = schedule
    
    def _signal_handler(self, signum, frame) -> None:
        """信号处理器"""
        logger.info(f"接收到信号 {signum}，正在停止调度器...")
        self.stop()
        sys.exit(0)
    
    def add_scraping_job(self, 
                        interval_minutes: int = 30,
                        start_time: str = "09:00",
                        end_time: str = "23:00") -> None:
        """添加数据抓取任务"""
        try:
            if self.use_apscheduler:
                # 使用cron表达式，每隔指定分钟执行一次
                self.scheduler.add_job(
                    func=self._run_scraping_task,
                    trigger=IntervalTrigger(minutes=interval_minutes),
                    id='scraping_job',
                    name='台湾PK10数据抓取',
                    replace_existing=True
                )
                
                # 添加工作时间限制（可选）
                if start_time and end_time:
                    # 在指定时间范围内每隔指定分钟执行
                    start_hour, start_minute = map(int, start_time.split(':'))
                    end_hour, end_minute = map(int, end_time.split(':'))
                    
                    # 创建更精确的cron触发器
                    cron_trigger = CronTrigger(
                        minute=f'*/{interval_minutes}',
                        hour=f'{start_hour}-{end_hour}',
                        timezone='Asia/Shanghai'
                    )
                    
                    self.scheduler.add_job(
                        func=self._run_scraping_task,
                        trigger=cron_trigger,
                        id='scraping_job_timed',
                        name='台湾PK10数据抓取(定时)',
                        replace_existing=True
                    )
            else:
                # 使用schedule库
                schedule.every(interval_minutes).minutes.do(self._run_scraping_task)
            
            logger.info(f"已添加数据抓取任务，间隔: {interval_minutes} 分钟")
            
        except Exception as e:
            logger.error(f"添加抓取任务失败: {e}")
    
    def add_cleanup_job(self, hour: int = 2, minute: int = 0) -> None:
        """添加数据清理任务"""
        try:
            if self.use_apscheduler:
                self.scheduler.add_job(
                    func=self._run_cleanup_task,
                    trigger=CronTrigger(hour=hour, minute=minute),
                    id='cleanup_job',
                    name='数据清理任务',
                    replace_existing=True
                )
            else:
                schedule.every().day.at(f"{hour:02d}:{minute:02d}").do(self._run_cleanup_task)
            
            logger.info(f"已添加数据清理任务，执行时间: {hour:02d}:{minute:02d}")
            
        except Exception as e:
            logger.error(f"添加清理任务失败: {e}")
    
    def add_api_sync_job(self, interval_minutes: int = 60) -> None:
        """添加API同步任务"""
        try:
            if self.use_apscheduler:
                self.scheduler.add_job(
                    func=self._run_api_sync_task,
                    trigger=IntervalTrigger(minutes=interval_minutes),
                    id='api_sync_job',
                    name='API数据同步',
                    replace_existing=True
                )
            else:
                schedule.every(interval_minutes).minutes.do(self._run_api_sync_task)
            
            logger.info(f"已添加API同步任务，间隔: {interval_minutes} 分钟")
            
        except Exception as e:
            logger.error(f"添加API同步任务失败: {e}")
    
    def _run_scraping_task(self) -> None:
        """执行数据抓取任务"""
        try:
            logger.info("开始执行数据抓取任务")
            start_time = datetime.now()
            
            # 连接数据库
            if not self.db_manager.connect():
                logger.error("数据库连接失败，跳过本次抓取")
                return
            
            # 运行抓取器
            scraped_data = self.scraper.run_scraper(
                target_date=datetime.now(),
                max_pages=3
            )
            
            if scraped_data:
                # 保存到数据库
                result = self.db_manager.save_lottery_data(scraped_data)
                logger.info(f"抓取任务完成: {result}")
                
                # 触发API同步
                self._trigger_api_update()
            else:
                logger.warning("本次抓取未获得数据")
            
            # 关闭数据库连接
            self.db_manager.close_connection()
            
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(f"数据抓取任务完成，耗时: {duration:.2f} 秒")
            
        except Exception as e:
            logger.error(f"执行抓取任务失败: {e}")
    
    def _run_cleanup_task(self) -> None:
        """执行数据清理任务"""
        try:
            logger.info("开始执行数据清理任务")
            
            # 连接数据库
            if not self.db_manager.connect():
                logger.error("数据库连接失败，跳过清理任务")
                return
            
            # 清理7天前的数据
            deleted_count = self.db_manager.clean_old_data(days=7)
            logger.info(f"数据清理完成，删除了 {deleted_count} 条记录")
            
            # 获取统计信息
            stats = self.db_manager.get_statistics()
            logger.info(f"清理后数据库统计: {stats}")
            
            # 关闭数据库连接
            self.db_manager.close_connection()
            
        except Exception as e:
            logger.error(f"执行清理任务失败: {e}")
    
    def _run_api_sync_task(self) -> None:
        """执行API同步任务"""
        try:
            logger.info("开始执行API同步任务")
            
            # 连接数据库
            if not self.db_manager.connect():
                logger.error("数据库连接失败，跳过API同步")
                return
            
            # 获取最新数据
            latest_data = self.db_manager.get_latest_data(days=1, limit=100)
            
            if latest_data:
                # 调用API更新
                success = self.api_client.update_web_data(latest_data)
                if success:
                    logger.info(f"API同步成功，更新了 {len(latest_data)} 条数据")
                else:
                    logger.error("API同步失败")
            else:
                logger.info("没有需要同步的数据")
            
            # 关闭数据库连接
            self.db_manager.close_connection()
            
        except Exception as e:
            logger.error(f"执行API同步任务失败: {e}")
    
    def _trigger_api_update(self) -> None:
        """触发API更新"""
        try:
            # 异步触发API更新
            thread = Thread(target=self._run_api_sync_task)
            thread.daemon = True
            thread.start()
            
        except Exception as e:
            logger.error(f"触发API更新失败: {e}")
    
    def start(self) -> None:
        """启动调度器"""
        try:
            if self.use_apscheduler:
                self.scheduler.start()
                self.running = True
                logger.info("APScheduler调度器已启动")
                
                # 保持运行
                try:
                    while self.running and not self.stop_event.is_set():
                        time.sleep(1)
                except KeyboardInterrupt:
                    logger.info("接收到中断信号")
                    self.stop()
            else:
                self.running = True
                logger.info("Schedule调度器已启动")
                
                # 运行调度循环
                while self.running and not self.stop_event.is_set():
                    schedule.run_pending()
                    time.sleep(1)
            
        except Exception as e:
            logger.error(f"启动调度器失败: {e}")
    
    def stop(self) -> None:
        """停止调度器"""
        try:
            self.running = False
            self.stop_event.set()
            
            if self.use_apscheduler and self.scheduler:
                self.scheduler.shutdown(wait=True)
            
            # 清理资源
            self.scraper.cleanup()
            self.db_manager.close_connection()
            
            logger.info("调度器已停止")
            
        except Exception as e:
            logger.error(f"停止调度器失败: {e}")
    
    def get_job_status(self) -> Dict[str, Any]:
        """获取任务状态"""
        try:
            if self.use_apscheduler and self.scheduler:
                jobs = []
                for job in self.scheduler.get_jobs():
                    jobs.append({
                        'id': job.id,
                        'name': job.name,
                        'next_run': job.next_run_time.isoformat() if job.next_run_time else None,
                        'trigger': str(job.trigger)
                    })
                
                return {
                    'running': self.running,
                    'scheduler_type': 'APScheduler',
                    'jobs': jobs
                }
            else:
                return {
                    'running': self.running,
                    'scheduler_type': 'Schedule',
                    'jobs': len(schedule.jobs)
                }
                
        except Exception as e:
            logger.error(f"获取任务状态失败: {e}")
            return {'error': str(e)}
    
    def run_manual_scraping(self) -> Dict[str, Any]:
        """手动执行抓取任务"""
        try:
            logger.info("手动执行数据抓取")
            
            # 在新线程中执行抓取任务
            thread = Thread(target=self._run_scraping_task)
            thread.start()
            
            return {'status': 'started', 'message': '手动抓取任务已启动'}
            
        except Exception as e:
            logger.error(f"手动执行抓取失败: {e}")
            return {'status': 'error', 'message': str(e)}


def main():
    """主函数"""
    # 创建调度器
    scheduler = TaskScheduler(use_apscheduler=True)
    
    try:
        # 添加任务
        scheduler.add_scraping_job(interval_minutes=30)  # 每30分钟抓取一次
        scheduler.add_cleanup_job(hour=2, minute=0)      # 每天凌晨2点清理数据
        scheduler.add_api_sync_job(interval_minutes=60)  # 每小时同步一次API
        
        # 启动调度器
        logger.info("正在启动定时任务调度器...")
        scheduler.start()
        
    except KeyboardInterrupt:
        logger.info("接收到中断信号，正在停止...")
    except Exception as e:
        logger.error(f"调度器运行异常: {e}")
    finally:
        scheduler.stop()


if __name__ == "__main__":
    main()