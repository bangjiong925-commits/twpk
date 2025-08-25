#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vercel Functions适配的Python抓取器
用于在Vercel平台运行定时抓取任务
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from python_scraper import TaiwanPK10Scraper
    from database_manager import DatabaseManager
except ImportError as e:
    print(f"Import error: {e}")
    # 在Vercel环境中可能需要不同的导入路径
    pass

def handler(request):
    """
    Vercel Functions处理器
    支持HTTP请求触发的抓取任务
    """
    try:
        # 解析请求参数
        method = request.get('method', 'GET')
        query = request.get('query', {})
        body = request.get('body', {})
        
        # 获取操作类型
        action = query.get('action', 'scrape')
        
        if action == 'scrape':
            return handle_scrape_request(query)
        elif action == 'health':
            return handle_health_check()
        elif action == 'status':
            return handle_status_check()
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Invalid action',
                    'available_actions': ['scrape', 'health', 'status']
                })
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
        }

def handle_scrape_request(query: Dict[str, Any]) -> Dict[str, Any]:
    """
    处理抓取请求
    """
    try:
        # 初始化抓取器和数据库管理器
        scraper = TaiwanPK10Scraper()
        db_manager = DatabaseManager()
        
        # 获取参数
        force_scrape = query.get('force', 'false').lower() == 'true'
        save_to_db = query.get('save', 'true').lower() == 'true'
        
        # 执行抓取
        result = scraper.scrape_latest_single_record(save_to_db=save_to_db)
        
        if result:
            # 检查是否为新数据
            period_number = result.get('period_number')
            
            if not force_scrape and save_to_db:
                # 检查数据库中是否已存在
                if db_manager.connect():
                    existing = db_manager.collection.find_one({'period': str(period_number)})
                    db_manager.close_connection()
                    
                    if existing:
                        return {
                            'statusCode': 200,
                            'headers': {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            'body': json.dumps({
                                'success': True,
                                'message': 'Data already exists',
                                'period_number': period_number,
                                'is_new': False,
                                'timestamp': datetime.now().isoformat()
                            })
                        }
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'message': 'Scraping completed successfully',
                    'data': result,
                    'is_new': True,
                    'timestamp': datetime.now().isoformat()
                })
            }
        else:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'message': 'No data found',
                    'timestamp': datetime.now().isoformat()
                })
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
        }

def handle_health_check() -> Dict[str, Any]:
    """
    健康检查
    """
    try:
        # 检查数据库连接
        db_manager = DatabaseManager()
        db_connected = db_manager.connect()
        if db_connected:
            db_manager.close_connection()
        
        # 检查环境变量
        required_env_vars = ['MONGO_URL', 'DATABASE_URL']
        env_status = {}
        for var in required_env_vars:
            env_status[var] = os.getenv(var) is not None
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'status': 'healthy',
                'database_connected': db_connected,
                'environment_variables': env_status,
                'timestamp': datetime.now().isoformat(),
                'python_version': sys.version,
                'platform': 'vercel'
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
        }

def handle_status_check() -> Dict[str, Any]:
    """
    状态检查
    """
    try:
        db_manager = DatabaseManager()
        
        if not db_manager.connect():
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'error': 'Database connection failed',
                    'timestamp': datetime.now().isoformat()
                })
            }
        
        # 获取最新数据
        latest_data = db_manager.get_latest_data(days=1, limit=1)
        
        # 获取数据统计
        today = datetime.now().strftime('%Y-%m-%d')
        today_count = len(db_manager.get_data_by_date_range(today, today))
        
        db_manager.close_connection()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'latest_data': latest_data[0] if latest_data else None,
                'today_count': today_count,
                'last_check': datetime.now().isoformat(),
                'status': 'active'
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
        }

# Vercel Functions入口点
def main(request):
    """
    主入口点，兼容Vercel Functions
    """
    return handler(request)

# 如果直接运行此文件（用于本地测试）
if __name__ == '__main__':
    # 模拟请求进行测试
    test_request = {
        'method': 'GET',
        'query': {'action': 'health'},
        'body': {}
    }
    
    result = handler(test_request)
    print(json.dumps(result, indent=2, ensure_ascii=False))