#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Railway健康检查脚本
监控服务状态和数据库连接
"""

import os
import sys
import json
import time
import logging
import requests
from datetime import datetime
from typing import Dict, Any, Optional

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class HealthChecker:
    """健康检查器"""
    
    def __init__(self):
        self.railway_env = os.environ.get('RAILWAY_ENVIRONMENT', False)
        self.api_url = self._get_api_url()
        self.checks = {
            'environment': self.check_environment,
            'database': self.check_database,
            'api_server': self.check_api_server,
            'python_service': self.check_python_service,
            'disk_space': self.check_disk_space,
            'memory': self.check_memory
        }
    
    def _get_api_url(self) -> str:
        """获取API URL"""
        if self.railway_env:
            # Railway环境
            port = os.environ.get('PORT', '3000')
            return f"http://localhost:{port}"
        else:
            # 本地环境
            return "http://localhost:3000"
    
    def check_environment(self) -> Dict[str, Any]:
        """检查环境配置"""
        try:
            required_vars = [
                'NODE_ENV',
                'RAILWAY_ENVIRONMENT' if self.railway_env else 'LOCAL_ENV'
            ]
            
            missing_vars = []
            for var in required_vars:
                if not os.environ.get(var):
                    missing_vars.append(var)
            
            status = 'healthy' if not missing_vars else 'unhealthy'
            
            return {
                'status': status,
                'details': {
                    'environment': 'Railway' if self.railway_env else 'Local',
                    'node_env': os.environ.get('NODE_ENV', 'unknown'),
                    'python_version': sys.version,
                    'missing_vars': missing_vars,
                    'timezone': os.environ.get('TZ', 'unknown')
                }
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def check_database(self) -> Dict[str, Any]:
        """检查数据库连接"""
        try:
            # 导入数据库管理器
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from database_manager import DatabaseManager
            
            db_manager = DatabaseManager()
            
            # 测试连接
            if db_manager.connect():
                # 测试基本操作
                latest_data = db_manager.get_latest_data(days=1, limit=1)
                record_count = len(latest_data) if latest_data else 0
                
                db_manager.close_connection()
                
                return {
                    'status': 'healthy',
                    'details': {
                        'connection': 'successful',
                        'latest_records': record_count,
                        'database_type': 'MongoDB'
                    }
                }
            else:
                return {
                    'status': 'unhealthy',
                    'details': {
                        'connection': 'failed',
                        'error': 'Unable to connect to database'
                    }
                }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def check_api_server(self) -> Dict[str, Any]:
        """检查API服务器"""
        try:
            # 测试API健康检查端点
            response = requests.get(f"{self.api_url}/health", timeout=10)
            
            if response.status_code == 200:
                return {
                    'status': 'healthy',
                    'details': {
                        'response_code': response.status_code,
                        'response_time': response.elapsed.total_seconds(),
                        'api_url': self.api_url
                    }
                }
            else:
                return {
                    'status': 'unhealthy',
                    'details': {
                        'response_code': response.status_code,
                        'api_url': self.api_url
                    }
                }
        except requests.exceptions.RequestException as e:
            return {
                'status': 'error',
                'error': f"API request failed: {str(e)}"
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def check_python_service(self) -> Dict[str, Any]:
        """检查Python服务状态"""
        try:
            # 检查日志文件
            log_file = os.environ.get('LOG_FILE_PATH', '/tmp/auto_scheduler.log')
            
            if os.path.exists(log_file):
                # 读取最后几行日志
                with open(log_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    recent_lines = lines[-5:] if len(lines) >= 5 else lines
                
                # 检查最近的日志时间
                file_mtime = os.path.getmtime(log_file)
                last_modified = datetime.fromtimestamp(file_mtime)
                time_diff = (datetime.now() - last_modified).total_seconds()
                
                status = 'healthy' if time_diff < 300 else 'stale'  # 5分钟内有更新
                
                return {
                    'status': status,
                    'details': {
                        'log_file': log_file,
                        'last_modified': last_modified.isoformat(),
                        'seconds_since_update': time_diff,
                        'recent_logs': [line.strip() for line in recent_lines]
                    }
                }
            else:
                return {
                    'status': 'unhealthy',
                    'details': {
                        'log_file': log_file,
                        'error': 'Log file not found'
                    }
                }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def check_disk_space(self) -> Dict[str, Any]:
        """检查磁盘空间"""
        try:
            import shutil
            
            # 检查当前目录的磁盘空间
            total, used, free = shutil.disk_usage('.')
            
            # 转换为MB
            total_mb = total // (1024 * 1024)
            used_mb = used // (1024 * 1024)
            free_mb = free // (1024 * 1024)
            
            usage_percent = (used / total) * 100
            
            status = 'healthy' if usage_percent < 90 else 'warning' if usage_percent < 95 else 'critical'
            
            return {
                'status': status,
                'details': {
                    'total_mb': total_mb,
                    'used_mb': used_mb,
                    'free_mb': free_mb,
                    'usage_percent': round(usage_percent, 2)
                }
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def check_memory(self) -> Dict[str, Any]:
        """检查内存使用"""
        try:
            import psutil
            
            # 获取内存信息
            memory = psutil.virtual_memory()
            
            usage_percent = memory.percent
            status = 'healthy' if usage_percent < 80 else 'warning' if usage_percent < 90 else 'critical'
            
            return {
                'status': status,
                'details': {
                    'total_mb': round(memory.total / (1024 * 1024), 2),
                    'available_mb': round(memory.available / (1024 * 1024), 2),
                    'used_mb': round(memory.used / (1024 * 1024), 2),
                    'usage_percent': usage_percent
                }
            }
        except ImportError:
            return {
                'status': 'skipped',
                'details': {
                    'reason': 'psutil not available'
                }
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def run_all_checks(self) -> Dict[str, Any]:
        """运行所有健康检查"""
        results = {
            'timestamp': datetime.now().isoformat(),
            'environment': 'Railway' if self.railway_env else 'Local',
            'overall_status': 'healthy',
            'checks': {}
        }
        
        unhealthy_count = 0
        error_count = 0
        
        for check_name, check_func in self.checks.items():
            logger.info(f"运行检查: {check_name}")
            
            try:
                result = check_func()
                results['checks'][check_name] = result
                
                if result['status'] in ['unhealthy', 'critical']:
                    unhealthy_count += 1
                elif result['status'] == 'error':
                    error_count += 1
                    
            except Exception as e:
                logger.error(f"检查 {check_name} 失败: {e}")
                results['checks'][check_name] = {
                    'status': 'error',
                    'error': str(e)
                }
                error_count += 1
        
        # 确定总体状态
        if error_count > 0 or unhealthy_count > 2:
            results['overall_status'] = 'unhealthy'
        elif unhealthy_count > 0:
            results['overall_status'] = 'warning'
        
        results['summary'] = {
            'total_checks': len(self.checks),
            'healthy_checks': len(self.checks) - unhealthy_count - error_count,
            'unhealthy_checks': unhealthy_count,
            'error_checks': error_count
        }
        
        return results
    
    def save_health_report(self, results: Dict[str, Any]) -> None:
        """保存健康检查报告"""
        try:
            report_file = '/tmp/health_check_report.json'
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            
            logger.info(f"健康检查报告已保存到: {report_file}")
        except Exception as e:
            logger.error(f"保存健康检查报告失败: {e}")

def main():
    """主函数"""
    logger.info("开始健康检查...")
    
    checker = HealthChecker()
    results = checker.run_all_checks()
    
    # 保存报告
    checker.save_health_report(results)
    
    # 输出结果
    print(json.dumps(results, indent=2, ensure_ascii=False))
    
    # 根据结果设置退出码
    if results['overall_status'] == 'unhealthy':
        sys.exit(1)
    elif results['overall_status'] == 'warning':
        sys.exit(2)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()