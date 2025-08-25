#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Railway Python服务启动脚本
专为Railway环境优化的台湾PK10数据抓取服务
"""

import os
import sys
import logging
import signal
import time
from datetime import datetime

# 设置Railway环境优化
def setup_railway_environment():
    """配置Railway环境"""
    # 设置时区
    os.environ.setdefault('TZ', 'Asia/Taipei')
    
    # 设置Python环境
    os.environ.setdefault('PYTHONUNBUFFERED', '1')
    os.environ.setdefault('PYTHONDONTWRITEBYTECODE', '1')
    
    # 设置日志路径
    log_path = os.environ.get('LOG_FILE_PATH', '/tmp/auto_scheduler.log')
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    
    # 设置Chrome/Selenium环境
    os.environ.setdefault('DISPLAY', ':99')
    os.environ.setdefault('CHROME_NO_SANDBOX', 'true')
    
    print(f"✅ Railway环境配置完成")
    print(f"📍 时区: {os.environ.get('TZ')}")
    print(f"📝 日志路径: {log_path}")
    print(f"🐍 Python版本: {sys.version}")

def setup_logging():
    """配置日志系统"""
    log_level = os.environ.get('LOG_LEVEL', 'INFO')
    log_file = os.environ.get('LOG_FILE_PATH', '/tmp/auto_scheduler.log')
    
    # 确保日志目录存在
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file, encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    logger = logging.getLogger(__name__)
    logger.info(f"🚀 Railway Python服务启动")
    logger.info(f"📅 启动时间: {datetime.now()}")
    logger.info(f"🌍 环境: Railway Production")
    
    return logger

def check_dependencies():
    """检查依赖包"""
    required_packages = [
        'selenium',
        'pymongo',
        'requests',
        'beautifulsoup4',
        'schedule',
        'loguru'
    ]
    
    missing_packages = []
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ 缺少依赖包: {', '.join(missing_packages)}")
        print("请确保requirements.txt中包含所有必要的依赖")
        return False
    
    print("✅ 所有依赖包检查通过")
    return True

def check_environment_variables():
    """检查必要的环境变量"""
    required_vars = [
        'RAILWAY_ENVIRONMENT',
        'DATABASE_URL',  # MongoDB连接
    ]
    
    optional_vars = [
        'MONGO_URL',
        'MONGO_PUBLIC_URL',
        'SCRAPE_SCHEDULE_START',
        'SCRAPE_SCHEDULE_END',
        'SCRAPE_INTERVAL_SECONDS'
    ]
    
    missing_required = []
    for var in required_vars:
        if not os.environ.get(var):
            missing_required.append(var)
    
    if missing_required:
        print(f"❌ 缺少必要环境变量: {', '.join(missing_required)}")
        return False
    
    print("✅ 必要环境变量检查通过")
    
    # 显示可选环境变量状态
    for var in optional_vars:
        value = os.environ.get(var)
        status = "✅" if value else "⚠️"
        print(f"{status} {var}: {'已设置' if value else '未设置'}")
    
    return True

def signal_handler(signum, frame):
    """信号处理器"""
    print(f"\n🛑 接收到信号 {signum}，正在优雅关闭...")
    sys.exit(0)

def main():
    """主函数"""
    print("🚀 启动Railway Python服务...")
    
    # 设置信号处理
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # 1. 设置Railway环境
        setup_railway_environment()
        
        # 2. 配置日志
        logger = setup_logging()
        
        # 3. 检查依赖
        if not check_dependencies():
            logger.error("依赖检查失败，退出")
            sys.exit(1)
        
        # 4. 检查环境变量
        if not check_environment_variables():
            logger.error("环境变量检查失败，退出")
            sys.exit(1)
        
        # 5. 导入并启动自动调度器
        logger.info("正在导入自动调度器...")
        
        # 确保当前目录在Python路径中
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if current_dir not in sys.path:
            sys.path.insert(0, current_dir)
        
        # 导入自动调度器
        from auto_scheduler import AutoScheduler
        
        logger.info("✅ 自动调度器导入成功")
        
        # 创建并启动调度器
        scheduler = AutoScheduler()
        logger.info("🎯 开始运行自动调度器...")
        
        # 启动调度器（阻塞运行）
        scheduler.start()
        
    except KeyboardInterrupt:
        print("\n👋 用户中断，正在退出...")
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()