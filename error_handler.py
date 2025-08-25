#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
错误处理和日志记录模块
提供统一的异常处理、日志记录和错误恢复机制
"""

import os
import sys
import traceback
import functools
import json
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Union, Type
from pathlib import Path
from enum import Enum

from loguru import logger
import psutil
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class ErrorLevel(Enum):
    """错误级别枚举"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ErrorType(Enum):
    """错误类型枚举"""
    NETWORK_ERROR = "NETWORK_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    SCRAPING_ERROR = "SCRAPING_ERROR"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    SYSTEM_ERROR = "SYSTEM_ERROR"
    API_ERROR = "API_ERROR"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR"
    PERMISSION_ERROR = "PERMISSION_ERROR"
    DATA_ERROR = "DATA_ERROR"


class ScrapingError(Exception):
    """抓取相关异常"""
    def __init__(self, message: str, error_type: ErrorType = ErrorType.SCRAPING_ERROR, details: Optional[Dict] = None):
        super().__init__(message)
        self.error_type = error_type
        self.details = details or {}
        self.timestamp = datetime.now()


class DatabaseError(Exception):
    """数据库相关异常"""
    def __init__(self, message: str, error_type: ErrorType = ErrorType.DATABASE_ERROR, details: Optional[Dict] = None):
        super().__init__(message)
        self.error_type = error_type
        self.details = details or {}
        self.timestamp = datetime.now()


class APIError(Exception):
    """API相关异常"""
    def __init__(self, message: str, status_code: Optional[int] = None, error_type: ErrorType = ErrorType.API_ERROR, details: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type
        self.details = details or {}
        self.timestamp = datetime.now()


class LoggerConfig:
    """日志配置类"""
    
    def __init__(self, 
                 log_dir: str = "logs",
                 log_level: str = "INFO",
                 max_file_size: str = "10 MB",
                 retention_days: int = 7,
                 enable_console: bool = True,
                 enable_file: bool = True,
                 enable_json: bool = False):
        
        self.log_dir = Path(log_dir)
        self.log_level = log_level
        self.max_file_size = max_file_size
        self.retention_days = retention_days
        self.enable_console = enable_console
        self.enable_file = enable_file
        self.enable_json = enable_json
        
        # 创建日志目录
        self.log_dir.mkdir(exist_ok=True)
        
        self._setup_logger()
    
    def _setup_logger(self) -> None:
        """设置日志配置"""
        # 移除默认处理器
        logger.remove()
        
        # 控制台日志
        if self.enable_console:
            logger.add(
                sys.stderr,
                level=self.log_level,
                format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
                colorize=True
            )
        
        # 文件日志
        if self.enable_file:
            # 普通日志文件
            logger.add(
                self.log_dir / "scraper_{time:YYYY-MM-DD}.log",
                level=self.log_level,
                format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
                rotation="1 day",
                retention=f"{self.retention_days} days",
                compression="zip"
            )
            
            # 错误日志文件
            logger.add(
                self.log_dir / "errors_{time:YYYY-MM-DD}.log",
                level="ERROR",
                format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
                rotation="1 day",
                retention=f"{self.retention_days} days",
                compression="zip"
            )
        
        # JSON格式日志（用于日志分析）
        if self.enable_json:
            logger.add(
                self.log_dir / "scraper_{time:YYYY-MM-DD}.json",
                level=self.log_level,
                format="{message}",
                rotation="1 day",
                retention=f"{self.retention_days} days",
                serialize=True
            )


class ErrorHandler:
    """错误处理器"""
    
    def __init__(self, 
                 logger_config: Optional[LoggerConfig] = None,
                 enable_system_monitoring: bool = True,
                 max_error_count: int = 100,
                 error_threshold_minutes: int = 60):
        
        self.logger_config = logger_config or LoggerConfig()
        self.enable_system_monitoring = enable_system_monitoring
        self.max_error_count = max_error_count
        self.error_threshold_minutes = error_threshold_minutes
        
        # 错误统计
        self.error_counts: Dict[str, int] = {}
        self.error_history: List[Dict[str, Any]] = []
        
        # 系统信息
        self.system_info = self._get_system_info() if enable_system_monitoring else {}
        
        logger.info("错误处理器初始化完成")
    
    def _get_system_info(self) -> Dict[str, Any]:
        """获取系统信息"""
        try:
            return {
                'cpu_count': psutil.cpu_count(),
                'memory_total': psutil.virtual_memory().total,
                'disk_usage': psutil.disk_usage('/').percent,
                'python_version': sys.version,
                'platform': sys.platform,
                'pid': os.getpid()
            }
        except Exception as e:
            logger.warning(f"获取系统信息失败: {e}")
            return {}
    
    def log_error(self, 
                  error: Exception, 
                  context: Optional[Dict[str, Any]] = None,
                  error_type: Optional[ErrorType] = None,
                  level: ErrorLevel = ErrorLevel.ERROR) -> str:
        """记录错误"""
        try:
            # 生成错误ID
            error_id = f"ERR_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{id(error)}"
            
            # 获取错误信息
            error_info = {
                'error_id': error_id,
                'timestamp': datetime.now().isoformat(),
                'error_type': error_type.value if error_type else type(error).__name__,
                'message': str(error),
                'traceback': traceback.format_exc(),
                'context': context or {},
                'system_info': self.system_info
            }
            
            # 添加特定错误类型的详细信息
            if hasattr(error, 'error_type'):
                error_info['custom_error_type'] = error.error_type.value
            if hasattr(error, 'details'):
                error_info['details'] = error.details
            if hasattr(error, 'status_code'):
                error_info['status_code'] = error.status_code
            
            # 记录到历史
            self.error_history.append(error_info)
            
            # 更新错误计数
            error_key = error_info['error_type']
            self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1
            
            # 记录日志
            log_message = f"[{error_id}] {error_info['message']}"
            if context:
                log_message += f" | Context: {json.dumps(context, ensure_ascii=False)}"
            
            if level == ErrorLevel.CRITICAL:
                logger.critical(log_message)
            elif level == ErrorLevel.ERROR:
                logger.error(log_message)
            elif level == ErrorLevel.WARNING:
                logger.warning(log_message)
            else:
                logger.info(log_message)
            
            # 检查错误阈值
            self._check_error_threshold()
            
            return error_id
            
        except Exception as e:
            logger.critical(f"记录错误失败: {e}")
            return "ERR_UNKNOWN"
    
    def _check_error_threshold(self) -> None:
        """检查错误阈值"""
        try:
            # 检查总错误数
            total_errors = sum(self.error_counts.values())
            if total_errors >= self.max_error_count:
                logger.critical(f"错误数量达到阈值: {total_errors}/{self.max_error_count}")
                self._trigger_emergency_action()
            
            # 检查时间窗口内的错误频率
            recent_errors = [
                err for err in self.error_history
                if (datetime.now() - datetime.fromisoformat(err['timestamp'])).total_seconds() < self.error_threshold_minutes * 60
            ]
            
            if len(recent_errors) >= self.max_error_count // 2:
                logger.critical(f"短时间内错误频率过高: {len(recent_errors)} 个错误在 {self.error_threshold_minutes} 分钟内")
                self._trigger_emergency_action()
                
        except Exception as e:
            logger.error(f"检查错误阈值失败: {e}")
    
    def _trigger_emergency_action(self) -> None:
        """触发紧急处理"""
        try:
            logger.critical("触发紧急处理机制")
            
            # 保存错误报告
            self.save_error_report()
            
            # 可以在这里添加其他紧急处理逻辑
            # 例如：发送告警邮件、停止服务等
            
        except Exception as e:
            logger.critical(f"紧急处理失败: {e}")
    
    def save_error_report(self, filename: Optional[str] = None) -> str:
        """保存错误报告"""
        try:
            if not filename:
                filename = f"error_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            report_path = self.logger_config.log_dir / filename
            
            report = {
                'timestamp': datetime.now().isoformat(),
                'system_info': self.system_info,
                'error_counts': self.error_counts,
                'error_history': self.error_history[-50:],  # 最近50个错误
                'total_errors': sum(self.error_counts.values())
            }
            
            with open(report_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            
            logger.info(f"错误报告已保存: {report_path}")
            return str(report_path)
            
        except Exception as e:
            logger.error(f"保存错误报告失败: {e}")
            return ""
    
    def get_error_statistics(self) -> Dict[str, Any]:
        """获取错误统计信息"""
        try:
            return {
                'total_errors': sum(self.error_counts.values()),
                'error_counts_by_type': self.error_counts.copy(),
                'recent_errors_count': len([
                    err for err in self.error_history
                    if (datetime.now() - datetime.fromisoformat(err['timestamp'])).total_seconds() < 3600
                ]),
                'last_error_time': self.error_history[-1]['timestamp'] if self.error_history else None,
                'system_info': self.system_info
            }
        except Exception as e:
            logger.error(f"获取错误统计失败: {e}")
            return {}
    
    def clear_error_history(self, keep_recent: int = 10) -> None:
        """清理错误历史"""
        try:
            if len(self.error_history) > keep_recent:
                self.error_history = self.error_history[-keep_recent:]
                logger.info(f"错误历史已清理，保留最近 {keep_recent} 条记录")
        except Exception as e:
            logger.error(f"清理错误历史失败: {e}")


# 全局错误处理器实例
_global_error_handler: Optional[ErrorHandler] = None


def get_error_handler() -> ErrorHandler:
    """获取全局错误处理器"""
    global _global_error_handler
    if _global_error_handler is None:
        _global_error_handler = ErrorHandler()
    return _global_error_handler


def setup_error_handler(logger_config: Optional[LoggerConfig] = None, **kwargs) -> ErrorHandler:
    """设置全局错误处理器"""
    global _global_error_handler
    _global_error_handler = ErrorHandler(logger_config=logger_config, **kwargs)
    return _global_error_handler


# 装饰器
def handle_errors(error_type: Optional[ErrorType] = None, 
                 reraise: bool = False,
                 default_return: Any = None,
                 context_func: Optional[Callable] = None):
    """错误处理装饰器"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # 获取上下文信息
                context = {
                    'function': func.__name__,
                    'args': str(args)[:200],  # 限制长度
                    'kwargs': str(kwargs)[:200]
                }
                
                if context_func:
                    try:
                        additional_context = context_func(*args, **kwargs)
                        context.update(additional_context)
                    except Exception:
                        pass
                
                # 记录错误
                error_handler = get_error_handler()
                error_id = error_handler.log_error(e, context=context, error_type=error_type)
                
                # 是否重新抛出异常
                if reraise:
                    raise
                else:
                    logger.warning(f"函数 {func.__name__} 执行失败，返回默认值: {default_return}")
                    return default_return
        
        return wrapper
    return decorator


def retry_on_error(max_retries: int = 3, 
                  delay: float = 1.0, 
                  backoff_factor: float = 2.0,
                  exceptions: tuple = (Exception,)):
    """重试装饰器"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    if attempt < max_retries:
                        wait_time = delay * (backoff_factor ** attempt)
                        logger.warning(f"函数 {func.__name__} 第 {attempt + 1} 次尝试失败，{wait_time:.2f}秒后重试: {e}")
                        
                        import time
                        time.sleep(wait_time)
                    else:
                        logger.error(f"函数 {func.__name__} 重试 {max_retries} 次后仍然失败")
                        
                        # 记录最终失败
                        error_handler = get_error_handler()
                        error_handler.log_error(
                            last_exception, 
                            context={
                                'function': func.__name__,
                                'max_retries': max_retries,
                                'final_attempt': True
                            }
                        )
                        raise
            
            return None
        
        return wrapper
    return decorator


# 上下文管理器
class ErrorContext:
    """错误上下文管理器"""
    
    def __init__(self, 
                 operation_name: str,
                 error_type: Optional[ErrorType] = None,
                 context: Optional[Dict[str, Any]] = None,
                 reraise: bool = True):
        self.operation_name = operation_name
        self.error_type = error_type
        self.context = context or {}
        self.reraise = reraise
        self.start_time = None
        self.error_handler = get_error_handler()
    
    def __enter__(self):
        self.start_time = datetime.now()
        logger.info(f"开始执行操作: {self.operation_name}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.now() - self.start_time).total_seconds()
        
        if exc_type is None:
            logger.info(f"操作完成: {self.operation_name}，耗时: {duration:.2f}秒")
        else:
            # 添加操作信息到上下文
            self.context.update({
                'operation': self.operation_name,
                'duration': duration
            })
            
            # 记录错误
            self.error_handler.log_error(
                exc_val, 
                context=self.context, 
                error_type=self.error_type
            )
            
            logger.error(f"操作失败: {self.operation_name}，耗时: {duration:.2f}秒")
            
            # 是否抑制异常
            return not self.reraise


if __name__ == "__main__":
    # 测试错误处理器
    error_handler = setup_error_handler()
    
    # 测试错误记录
    try:
        raise ScrapingError("测试抓取错误", ErrorType.SCRAPING_ERROR, {'url': 'test.com'})
    except Exception as e:
        error_id = error_handler.log_error(e)
        print(f"错误已记录，ID: {error_id}")
    
    # 测试装饰器
    @handle_errors(error_type=ErrorType.SYSTEM_ERROR, default_return="默认值")
    def test_function():
        raise ValueError("测试错误")
    
    result = test_function()
    print(f"函数返回: {result}")
    
    # 测试上下文管理器
    with ErrorContext("测试操作", ErrorType.SYSTEM_ERROR):
        print("执行一些操作...")
    
    # 获取统计信息
    stats = error_handler.get_error_statistics()
    print(f"错误统计: {stats}")