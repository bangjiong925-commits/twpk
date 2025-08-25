#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MongoDB数据库管理器
处理台湾PK10数据的数据库连接、保存和查询操作
"""

import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dataclasses import asdict

import pymongo
from pymongo import MongoClient, DESCENDING
from pymongo.errors import ConnectionFailure, DuplicateKeyError, PyMongoError
from loguru import logger
from dotenv import load_dotenv

from python_scraper import LotteryData

# 加载环境变量
load_dotenv()


class DatabaseManager:
    """MongoDB数据库管理器"""
    
    def __init__(self):
        self.client = None
        self.db = None
        self.collection = None
        self.connection_string = self._get_connection_string()
        
        # 配置日志
        logger.add("logs/database_{time}.log", rotation="1 day", retention="7 days")
    
    def _get_connection_string(self) -> str:
        """获取数据库连接字符串"""
        # 优先级顺序：DATABASE_URL > MONGO_URL > 本地MongoDB
        connection_string = (
            os.getenv('DATABASE_URL') or 
            os.getenv('MONGO_URL') or 
            'mongodb://localhost:27017/taiwanpk10'
        )
        
        logger.info(f"使用数据库连接: {connection_string[:50]}...")
        return connection_string
    
    def connect(self) -> bool:
        """连接到MongoDB数据库"""
        try:
            # 连接配置
            connect_options = {
                'serverSelectionTimeoutMS': 5000,
                'connectTimeoutMS': 10000,
                'socketTimeoutMS': 20000,
                'maxPoolSize': 10,
                'retryWrites': True
            }
            
            # 如果是MongoDB Atlas连接，添加额外配置
            if 'mongodb.net' in self.connection_string or 'mongodb+srv' in self.connection_string:
                connect_options.update({
                    'ssl': True,
                    'ssl_cert_reqs': 'CERT_NONE',
                    'authSource': 'admin'
                })
            
            # 创建客户端连接
            self.client = MongoClient(self.connection_string, **connect_options)
            
            # 测试连接
            self.client.admin.command('ping')
            
            # 获取数据库和集合
            db_name = os.getenv('DB_NAME', 'taiwanpk10')
            self.db = self.client[db_name]
            self.collection = self.db['taiwanPK10Data']
            
            # 创建索引
            self._create_indexes()
            
            logger.info(f"成功连接到MongoDB数据库: {db_name}")
            return True
            
        except ConnectionFailure as e:
            logger.error(f"MongoDB连接失败: {e}")
            return False
        except Exception as e:
            logger.error(f"数据库连接异常: {e}")
            return False
    
    def _create_indexes(self) -> None:
        """创建数据库索引"""
        try:
            # 创建唯一索引
            self.collection.create_index("period", unique=True)
            
            # 创建复合索引
            self.collection.create_index([("drawDate", DESCENDING), ("period", DESCENDING)])
            self.collection.create_index([("scrapedAt", DESCENDING)])
            
            # 创建普通索引
            self.collection.create_index("drawDate")
            self.collection.create_index("dataSource")
            self.collection.create_index("isValid")
            
            logger.info("数据库索引创建完成")
            
        except Exception as e:
            logger.warning(f"创建索引失败: {e}")
    
    def save_lottery_data(self, data_list: List[LotteryData]) -> Dict[str, int]:
        """保存彩票数据到数据库"""
        if self.collection is None:
            logger.error("数据库未连接")
            return {'saved': 0, 'duplicates': 0, 'errors': 0}
        
        saved_count = 0
        duplicate_count = 0
        error_count = 0
        
        for lottery_data in data_list:
            try:
                # 转换为字典格式
                doc = {
                    'period': lottery_data.period,
                    'drawNumbers': lottery_data.draw_numbers,
                    'drawDate': lottery_data.draw_date,
                    'drawTime': lottery_data.draw_time,
                    'dataSource': lottery_data.data_source,
                    'isValid': lottery_data.is_valid,
                    'scrapedAt': datetime.now(),
                    'createdAt': datetime.now(),
                    'updatedAt': datetime.now()
                }
                
                # 插入数据
                self.collection.insert_one(doc)
                saved_count += 1
                
            except DuplicateKeyError:
                # 期号已存在，尝试更新
                try:
                    update_doc = {
                        '$set': {
                            'drawNumbers': lottery_data.draw_numbers,
                            'drawDate': lottery_data.draw_date,
                            'drawTime': lottery_data.draw_time,
                            'dataSource': lottery_data.data_source,
                            'isValid': lottery_data.is_valid,
                            'updatedAt': datetime.now()
                        }
                    }
                    
                    result = self.collection.update_one(
                        {'period': lottery_data.period},
                        update_doc
                    )
                    
                    if result.modified_count > 0:
                        saved_count += 1
                        logger.info(f"更新期号 {lottery_data.period} 的数据")
                    else:
                        duplicate_count += 1
                        
                except Exception as e:
                    logger.error(f"更新期号 {lottery_data.period} 失败: {e}")
                    error_count += 1
                    
            except Exception as e:
                logger.error(f"保存期号 {lottery_data.period} 失败: {e}")
                error_count += 1
        
        result = {
            'saved': saved_count,
            'duplicates': duplicate_count,
            'errors': error_count
        }
        
        logger.info(f"数据保存完成: {result}")
        return result
    
    def save_lottery_data_to_collection(self, data_list: List[LotteryData], collection_name: str) -> Dict[str, int]:
        """保存彩票数据到指定集合"""
        if self.db is None:
            logger.error("数据库未连接")
            return {'saved': 0, 'duplicates': 0, 'errors': 0}
        
        try:
            # 获取指定集合
            collection = self.db[collection_name]
            
            # 为新集合创建索引
            try:
                collection.create_index("period", unique=True)
                collection.create_index("drawDate")
                collection.create_index("scrapedAt")
            except Exception as e:
                logger.debug(f"创建索引时出现警告（可能已存在）: {e}")
            
            saved_count = 0
            duplicate_count = 0
            error_count = 0
            
            for lottery_data in data_list:
                try:
                    # 转换为字典格式
                    doc = {
                        'period': lottery_data.period,
                        'drawNumbers': lottery_data.draw_numbers,
                        'drawDate': lottery_data.draw_date,
                        'drawTime': lottery_data.draw_time,
                        'dataSource': lottery_data.data_source,
                        'isValid': lottery_data.is_valid,
                        'scrapedAt': datetime.now(),
                        'createdAt': datetime.now(),
                        'updatedAt': datetime.now()
                    }
                    
                    # 插入数据
                    collection.insert_one(doc)
                    saved_count += 1
                    
                except DuplicateKeyError:
                    # 期号已存在，尝试更新
                    try:
                        update_doc = {
                            '$set': {
                                'drawNumbers': lottery_data.draw_numbers,
                                'drawDate': lottery_data.draw_date,
                                'drawTime': lottery_data.draw_time,
                                'dataSource': lottery_data.data_source,
                                'isValid': lottery_data.is_valid,
                                'updatedAt': datetime.now()
                            }
                        }
                        
                        result = collection.update_one(
                            {'period': lottery_data.period},
                            update_doc
                        )
                        
                        if result.modified_count > 0:
                            saved_count += 1
                            logger.info(f"更新期号 {lottery_data.period} 的数据到集合 {collection_name}")
                        else:
                            duplicate_count += 1
                            
                    except Exception as e:
                        logger.error(f"更新期号 {lottery_data.period} 到集合 {collection_name} 失败: {e}")
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"保存期号 {lottery_data.period} 到集合 {collection_name} 失败: {e}")
                    error_count += 1
            
            result = {
                'saved': saved_count,
                'duplicates': duplicate_count,
                'errors': error_count
            }
            
            logger.info(f"数据保存到集合 {collection_name} 完成: {result}")
            return result
            
        except Exception as e:
            logger.error(f"保存数据到集合 {collection_name} 时发生错误: {e}")
            return {'saved': 0, 'duplicates': 0, 'errors': 0}
    
    def get_collection_count(self, collection_name: str) -> int:
        """获取指定集合的数据量"""
        if self.db is None:
            logger.error("数据库未连接")
            return 0
        
        try:
            collection = self.db[collection_name]
            count = collection.count_documents({})
            return count
        except Exception as e:
            logger.error(f"获取集合 {collection_name} 数据量失败: {e}")
            return 0
    
    def check_period_exists_in_collection(self, period: str, collection_name: str) -> bool:
        """检查指定集合中是否存在某个期号"""
        if self.db is None:
            logger.error("数据库未连接")
            return False
        
        try:
            collection = self.db[collection_name]
            result = collection.find_one({'period': period})
            return result is not None
        except Exception as e:
            logger.error(f"检查集合 {collection_name} 中期号 {period} 失败: {e}")
            return False
     
    def get_latest_data(self, days: int = 3, limit: int = 1000) -> List[Dict[str, Any]]:
        """获取最新数据"""
        if self.collection is None:
            logger.error("数据库未连接")
            return []
        
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            cursor = self.collection.find({
                'date': {'$gte': start_date.strftime('%Y-%m-%d')},
                'is_valid': True
            }).sort('period', DESCENDING).limit(limit)
            
            data = list(cursor)
            
            # 转换ObjectId为字符串
            for item in data:
                if '_id' in item:
                    item['_id'] = str(item['_id'])
                if 'drawDate' in item and isinstance(item['drawDate'], datetime):
                    item['drawDate'] = item['drawDate'].isoformat()
                if 'scrapedAt' in item and isinstance(item['scrapedAt'], datetime):
                    item['scrapedAt'] = item['scrapedAt'].isoformat()
                if 'createdAt' in item and isinstance(item['createdAt'], datetime):
                    item['createdAt'] = item['createdAt'].isoformat()
                if 'updatedAt' in item and isinstance(item['updatedAt'], datetime):
                    item['updatedAt'] = item['updatedAt'].isoformat()
            
            logger.info(f"获取到 {len(data)} 条最新数据")
            return data
            
        except Exception as e:
            logger.error(f"获取最新数据失败: {e}")
            return []
    
    def get_data_by_date(self, target_date: datetime) -> List[Dict[str, Any]]:
        """按日期获取数据"""
        if self.collection is None:
            logger.error("数据库未连接")
            return []
        
        try:
            start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            cursor = self.collection.find({
                'drawDate': {'$gte': start_of_day, '$lte': end_of_day},
                'isValid': True
            }).sort('period', DESCENDING)
            
            data = list(cursor)
            
            # 转换ObjectId为字符串
            for item in data:
                if '_id' in item:
                    item['_id'] = str(item['_id'])
                if 'drawDate' in item and isinstance(item['drawDate'], datetime):
                    item['drawDate'] = item['drawDate'].isoformat()
                if 'scrapedAt' in item and isinstance(item['scrapedAt'], datetime):
                    item['scrapedAt'] = item['scrapedAt'].isoformat()
            
            logger.info(f"获取到 {target_date.strftime('%Y-%m-%d')} 的 {len(data)} 条数据")
            return data
            
        except Exception as e:
            logger.error(f"按日期获取数据失败: {e}")
            return []
    
    def clean_old_data(self, days: int = 7) -> int:
        """清理旧数据"""
        if self.collection is None:
            logger.error("数据库未连接")
            return 0
        
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            result = self.collection.delete_many({
                'drawDate': {'$lt': cutoff_date}
            })
            
            deleted_count = result.deleted_count
            logger.info(f"清理了 {deleted_count} 条 {days} 天前的旧数据")
            return deleted_count
            
        except Exception as e:
            logger.error(f"清理旧数据失败: {e}")
            return 0
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取数据库统计信息"""
        try:
            if self.collection is None:
                return {'error': '数据库未连接'}
            
            stats = {
                'total_records': self.collection.count_documents({}),
                'today_records': 0,
                'latest_record': None,
                'database_size': 0
            }
            
            # 获取今日记录数
            today = datetime.now().strftime('%Y-%m-%d')
            stats['today_records'] = self.collection.count_documents({
                'drawDate': today
            })
            
            # 获取最新记录
            latest = self.collection.find_one(
                {},
                sort=[('scrapedAt', -1)]
            )
            if latest:
                stats['latest_record'] = {
                    'period': latest.get('period'),
                    'drawDate': latest.get('drawDate'),
                    'drawTime': latest.get('drawTime'),
                    'scrapedAt': latest.get('scrapedAt')
                }
            
            # 获取数据库大小（如果可能）
            try:
                db_stats = self.db.command('dbStats')
                stats['database_size'] = db_stats.get('dataSize', 0)
            except Exception:
                pass
            
            return stats
            
        except Exception as e:
            logger.error(f"获取数据库统计失败: {e}")
            return {'error': str(e)}
    
    def test_connection(self) -> bool:
        """测试数据库连接"""
        try:
            if self.client:
                self.client.admin.command('ping')
                logger.info("数据库连接正常")
                return True
            else:
                logger.error("数据库客户端未初始化")
                return False
                
        except Exception as e:
            logger.error(f"数据库连接测试失败: {e}")
            return False
    
    def close_connection(self) -> None:
        """关闭数据库连接"""
        try:
            if self.client:
                self.client.close()
                logger.info("数据库连接已关闭")
        except Exception as e:
            logger.error(f"关闭数据库连接失败: {e}")


if __name__ == "__main__":
    # 测试数据库管理器
    db_manager = DatabaseManager()
    
    if db_manager.connect():
        print("数据库连接成功")
        
        # 获取统计信息
        stats = db_manager.get_statistics()
        print(f"数据库统计: {stats}")
        
        # 测试连接
        if db_manager.test_connection():
            print("数据库连接测试通过")
        
        # 关闭连接
        db_manager.close_connection()
    else:
        print("数据库连接失败")