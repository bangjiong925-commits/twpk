#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的抓取工具测试脚本
用于验证各个组件的基本功能
"""

import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from loguru import logger

# 加载环境变量
load_dotenv()

def test_imports():
    """测试模块导入"""
    try:
        import python_scraper
        import database_manager
        import api_client
        import scheduler
        import error_handler
        logger.info("✅ 所有模块导入成功")
        return True
    except Exception as e:
        logger.error(f"❌ 模块导入失败: {e}")
        return False

def test_database_connection():
    """测试数据库连接"""
    try:
        from database_manager import DatabaseManager
        
        db_manager = DatabaseManager()
        if db_manager.connect():
            logger.info("✅ 数据库连接成功")
            
            # 测试基本操作
            stats = db_manager.get_statistics()
            logger.info(f"数据库统计: {stats}")
            
            db_manager.close_connection()
            return True
        else:
            logger.warning("⚠️ 数据库连接失败（可能MongoDB未运行）")
            return False
    except Exception as e:
        logger.error(f"❌ 数据库测试失败: {e}")
        return False

def test_scraper_initialization():
    """测试抓取器初始化"""
    try:
        from python_scraper import TaiwanPK10Scraper
        
        # 测试抓取器初始化（无头模式）
        scraper = TaiwanPK10Scraper(headless=True)
        logger.info("✅ 抓取器初始化成功")
        
        # 清理资源
        scraper.cleanup()
        return True
    except Exception as e:
        logger.error(f"❌ 抓取器初始化失败: {e}")
        logger.error("请确保已安装Chrome浏览器和ChromeDriver")
        return False

def test_api_client():
    """测试API客户端"""
    try:
        from api_client import APIClient
        
        api_client = APIClient(timeout=5)
        logger.info("✅ API客户端初始化成功")
        
        # 测试连接（预期会失败，因为服务器可能未运行）
        if api_client.test_connection():
            logger.info("✅ API连接测试成功")
        else:
            logger.warning("⚠️ API连接测试失败（预期行为，服务器可能未运行）")
        
        api_client.close()
        return True
    except Exception as e:
        logger.error(f"❌ API客户端测试失败: {e}")
        return False

def test_scheduler():
    """测试调度器"""
    try:
        from scheduler import TaskScheduler
        
        scheduler = TaskScheduler(use_apscheduler=True)
        logger.info("✅ 调度器初始化成功")
        
        # 测试任务状态
        status = scheduler.get_job_status()
        logger.info(f"调度器状态: {status}")
        
        return True
    except Exception as e:
        logger.error(f"❌ 调度器测试失败: {e}")
        return False

def test_error_handler():
    """测试错误处理器"""
    try:
        from error_handler import ErrorHandler, LoggerConfig, setup_error_handler
        
        # 设置错误处理器
        error_handler = setup_error_handler(
            LoggerConfig(
                log_dir='test_logs',
                log_level='INFO',
                retention_days=1
            )
        )
        
        logger.info("✅ 错误处理器初始化成功")
        
        # 测试错误统计
        stats = error_handler.get_error_statistics()
        logger.info(f"错误统计: {stats}")
        
        return True
    except Exception as e:
        logger.error(f"❌ 错误处理器测试失败: {e}")
        return False

def test_configuration():
    """测试配置加载"""
    try:
        import json
        
        # 测试配置文件
        if os.path.exists('config.json'):
            with open('config.json', 'r', encoding='utf-8') as f:
                config = json.load(f)
            logger.info("✅ 配置文件加载成功")
            logger.info(f"配置项数量: {len(config)}")
        else:
            logger.warning("⚠️ 配置文件不存在")
        
        # 测试环境变量
        env_vars = [
            'MONGO_URL', 'API_BASE_URL', 'SCRAPING_HEADLESS', 
            'LOG_LEVEL', 'ENABLE_SCHEDULER'
        ]
        
        for var in env_vars:
            value = os.getenv(var)
            if value:
                logger.info(f"环境变量 {var}: {value}")
            else:
                logger.warning(f"环境变量 {var} 未设置")
        
        return True
    except Exception as e:
        logger.error(f"❌ 配置测试失败: {e}")
        return False

def run_all_tests():
    """运行所有测试"""
    logger.info("🚀 开始运行Python抓取工具测试")
    logger.info("=" * 50)
    
    tests = [
        ("模块导入", test_imports),
        ("配置加载", test_configuration),
        ("错误处理器", test_error_handler),
        ("数据库连接", test_database_connection),
        ("API客户端", test_api_client),
        ("调度器", test_scheduler),
        ("抓取器初始化", test_scraper_initialization),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        logger.info(f"\n🧪 测试: {test_name}")
        logger.info("-" * 30)
        
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            logger.error(f"测试 {test_name} 发生异常: {e}")
            results.append((test_name, False))
    
    # 输出测试结果
    logger.info("\n" + "=" * 50)
    logger.info("📊 测试结果汇总")
    logger.info("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        logger.info(f"{test_name}: {status}")
        if result:
            passed += 1
    
    logger.info(f"\n总计: {passed}/{total} 个测试通过")
    
    if passed == total:
        logger.info("🎉 所有测试通过！Python抓取工具准备就绪")
    else:
        logger.warning(f"⚠️ {total - passed} 个测试失败，请检查相关配置")
    
    return passed == total

if __name__ == "__main__":
    # 配置日志
    logger.remove()
    logger.add(
        sys.stdout,
        format="{time:HH:mm:ss} | {level} | {message}",
        level="INFO"
    )
    
    success = run_all_tests()
    sys.exit(0 if success else 1)