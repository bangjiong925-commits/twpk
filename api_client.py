#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API客户端
用于与网页端进行数据同步和通信
"""

import os
import json
import time
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from urllib.parse import urljoin

import requests
import httpx
from loguru import logger
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class APIClient:
    """API客户端类"""
    
    def __init__(self, 
                 base_url: Optional[str] = None,
                 timeout: int = 30,
                 max_retries: int = 3,
                 use_async: bool = False):
        
        # 设置基础URL
        self.base_url = base_url or os.getenv('API_BASE_URL', 'http://localhost:3000')
        self.timeout = timeout
        self.max_retries = max_retries
        self.use_async = use_async
        
        # 设置请求头
        self.headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Python-Scraper/1.0',
            'Accept': 'application/json'
        }
        
        # API密钥（如果需要）
        api_key = os.getenv('API_KEY')
        if api_key:
            self.headers['Authorization'] = f'Bearer {api_key}'
        
        # 初始化HTTP客户端
        if use_async:
            self.client = httpx.AsyncClient(
                timeout=timeout,
                headers=self.headers
            )
        else:
            self.session = requests.Session()
            self.session.headers.update(self.headers)
        
        logger.info(f"API客户端初始化完成，基础URL: {self.base_url}")
    
    def _make_request(self, 
                     method: str, 
                     endpoint: str, 
                     data: Optional[Dict] = None,
                     params: Optional[Dict] = None) -> Optional[Dict]:
        """发送HTTP请求"""
        url = urljoin(self.base_url, endpoint)
        
        for attempt in range(self.max_retries):
            try:
                if self.use_async:
                    # 异步请求（需要在异步环境中调用）
                    response = self.client.request(
                        method=method,
                        url=url,
                        json=data,
                        params=params
                    )
                else:
                    # 同步请求
                    response = self.session.request(
                        method=method,
                        url=url,
                        json=data,
                        params=params,
                        timeout=self.timeout
                    )
                
                # 检查响应状态
                response.raise_for_status()
                
                # 解析JSON响应
                if response.content:
                    return response.json()
                else:
                    return {'status': 'success'}
                
            except requests.exceptions.RequestException as e:
                logger.warning(f"请求失败 (尝试 {attempt + 1}/{self.max_retries}): {e}")
                if attempt == self.max_retries - 1:
                    logger.error(f"请求最终失败: {url}")
                    return None
                time.sleep(2 ** attempt)  # 指数退避
            
            except json.JSONDecodeError as e:
                logger.error(f"JSON解析失败: {e}")
                return None
            
            except Exception as e:
                logger.error(f"未知错误: {e}")
                return None
        
        return None
    
    def test_connection(self) -> bool:
        """测试API连接"""
        try:
            response = self._make_request('GET', '/api/health')
            if response:
                logger.info("API连接测试成功")
                return True
            else:
                logger.error("API连接测试失败")
                return False
                
        except Exception as e:
            logger.error(f"API连接测试异常: {e}")
            return False
    
    def update_web_data(self, lottery_data: List[Dict[str, Any]]) -> bool:
        """更新网页端数据"""
        try:
            if not lottery_data:
                logger.warning("没有数据需要更新")
                return True
            
            # 格式化数据
            formatted_data = self._format_lottery_data(lottery_data)
            
            # 发送数据更新请求
            response = self._make_request(
                method='POST',
                endpoint='/api/taiwan-pk10/update',
                data={
                    'data': formatted_data,
                    'timestamp': datetime.now().isoformat(),
                    'source': 'python_scraper'
                }
            )
            
            if response and response.get('status') == 'success':
                logger.info(f"数据更新成功，更新了 {len(formatted_data)} 条记录")
                return True
            else:
                logger.error(f"数据更新失败: {response}")
                return False
                
        except Exception as e:
            logger.error(f"更新网页数据失败: {e}")
            return False
    
    def trigger_manual_fetch(self) -> Dict[str, Any]:
        """触发手动抓取"""
        try:
            response = self._make_request(
                method='POST',
                endpoint='/api/manual-fetch-today'
            )
            
            if response:
                logger.info("手动抓取触发成功")
                return response
            else:
                logger.error("手动抓取触发失败")
                return {'status': 'error', 'message': '请求失败'}
                
        except Exception as e:
            logger.error(f"触发手动抓取失败: {e}")
            return {'status': 'error', 'message': str(e)}
    
    def get_latest_data(self, limit: int = 50) -> Optional[List[Dict]]:
        """获取最新数据"""
        try:
            response = self._make_request(
                method='GET',
                endpoint='/api/taiwan-pk10/latest',
                params={'limit': limit}
            )
            
            if response and 'data' in response:
                logger.info(f"获取最新数据成功，共 {len(response['data'])} 条")
                return response['data']
            else:
                logger.error("获取最新数据失败")
                return None
                
        except Exception as e:
            logger.error(f"获取最新数据异常: {e}")
            return None
    
    def get_data_by_date(self, date: str) -> Optional[List[Dict]]:
        """按日期获取数据"""
        try:
            response = self._make_request(
                method='GET',
                endpoint='/api/taiwan-pk10/by-date',
                params={'date': date}
            )
            
            if response and 'data' in response:
                logger.info(f"获取日期数据成功: {date}，共 {len(response['data'])} 条")
                return response['data']
            else:
                logger.error(f"获取日期数据失败: {date}")
                return None
                
        except Exception as e:
            logger.error(f"获取日期数据异常: {e}")
            return None
    
    def send_notification(self, 
                         message: str, 
                         level: str = 'info',
                         data: Optional[Dict] = None) -> bool:
        """发送通知"""
        try:
            notification_data = {
                'message': message,
                'level': level,
                'timestamp': datetime.now().isoformat(),
                'source': 'python_scraper'
            }
            
            if data:
                notification_data['data'] = data
            
            response = self._make_request(
                method='POST',
                endpoint='/api/notifications',
                data=notification_data
            )
            
            if response:
                logger.info(f"通知发送成功: {message}")
                return True
            else:
                logger.error(f"通知发送失败: {message}")
                return False
                
        except Exception as e:
            logger.error(f"发送通知异常: {e}")
            return False
    
    def upload_scraping_log(self, log_data: Dict[str, Any]) -> bool:
        """上传抓取日志"""
        try:
            response = self._make_request(
                method='POST',
                endpoint='/api/scraping-logs',
                data=log_data
            )
            
            if response:
                logger.info("抓取日志上传成功")
                return True
            else:
                logger.error("抓取日志上传失败")
                return False
                
        except Exception as e:
            logger.error(f"上传抓取日志异常: {e}")
            return False
    
    def get_scraping_status(self) -> Optional[Dict[str, Any]]:
        """获取抓取状态"""
        try:
            response = self._make_request(
                method='GET',
                endpoint='/api/scraping-status'
            )
            
            if response:
                logger.info("获取抓取状态成功")
                return response
            else:
                logger.error("获取抓取状态失败")
                return None
                
        except Exception as e:
            logger.error(f"获取抓取状态异常: {e}")
            return None
    
    def _format_lottery_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """格式化彩票数据"""
        formatted_data = []
        
        for item in data:
            try:
                # 确保数据格式正确
                formatted_item = {
                    'period': str(item.get('period', '')),
                    'drawNumbers': item.get('drawNumbers', []),
                    'drawDate': item.get('drawDate', ''),
                    'drawTime': item.get('drawTime', ''),
                    'dataSource': item.get('dataSource', 'python_scraper'),
                    'scrapedAt': item.get('scrapedAt', datetime.now().isoformat()),
                    'isValid': item.get('isValid', True)
                }
                
                # 验证必要字段
                if formatted_item['period'] and formatted_item['drawNumbers']:
                    formatted_data.append(formatted_item)
                else:
                    logger.warning(f"跳过无效数据: {item}")
                    
            except Exception as e:
                logger.error(f"格式化数据失败: {e}, 数据: {item}")
                continue
        
        return formatted_data
    
    def batch_update_data(self, 
                         data_batches: List[List[Dict[str, Any]]], 
                         batch_size: int = 100) -> Dict[str, Any]:
        """批量更新数据"""
        results = {
            'total_batches': len(data_batches),
            'successful_batches': 0,
            'failed_batches': 0,
            'total_records': 0,
            'successful_records': 0
        }
        
        try:
            for i, batch in enumerate(data_batches):
                logger.info(f"处理批次 {i + 1}/{len(data_batches)}，记录数: {len(batch)}")
                
                success = self.update_web_data(batch)
                results['total_records'] += len(batch)
                
                if success:
                    results['successful_batches'] += 1
                    results['successful_records'] += len(batch)
                else:
                    results['failed_batches'] += 1
                
                # 批次间延迟
                if i < len(data_batches) - 1:
                    time.sleep(1)
            
            logger.info(f"批量更新完成: {results}")
            return results
            
        except Exception as e:
            logger.error(f"批量更新异常: {e}")
            results['error'] = str(e)
            return results
    
    def close(self) -> None:
        """关闭客户端连接"""
        try:
            if self.use_async and hasattr(self, 'client'):
                # 异步客户端需要在异步环境中关闭
                pass
            elif hasattr(self, 'session'):
                self.session.close()
            
            logger.info("API客户端连接已关闭")
            
        except Exception as e:
            logger.error(f"关闭API客户端失败: {e}")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# 便捷函数
def create_api_client(base_url: Optional[str] = None, **kwargs) -> APIClient:
    """创建API客户端实例"""
    return APIClient(base_url=base_url, **kwargs)


def test_api_connection(base_url: Optional[str] = None) -> bool:
    """测试API连接"""
    with create_api_client(base_url) as client:
        return client.test_connection()


if __name__ == "__main__":
    # 测试API客户端
    client = APIClient()
    
    # 测试连接
    if client.test_connection():
        print("API连接正常")
        
        # 获取最新数据
        latest_data = client.get_latest_data(limit=10)
        if latest_data:
            print(f"获取到 {len(latest_data)} 条最新数据")
        
        # 获取抓取状态
        status = client.get_scraping_status()
        if status:
            print(f"抓取状态: {status}")
    else:
        print("API连接失败")
    
    client.close()