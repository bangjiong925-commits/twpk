const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 动态导入ES模块
let TaiwanPK10Data;

// 获取昨天台湾PK10数据的API
router.get('/', async (req, res) => {
  try {
    // 动态导入模型（如果还没有导入）
    if (!TaiwanPK10Data) {
      const module = await import('../models/TaiwanPK10Data.js');
      TaiwanPK10Data = module.default;
    }

    // 检查数据库连接
    if (!global.dbAvailable) {
      return res.status(503).json({
        success: false,
        error: '数据库连接不可用',
        message: '请稍后重试'
      });
    }

    // 计算昨天的日期
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 获取昨天的数据
    const data = await TaiwanPK10Data.getDataByDate(yesterday);
    
    res.json({
      success: true,
      message: '昨天台湾PK10数据',
      data: data,
      count: data.length,
      date: yesterday.toISOString().split('T')[0], // 返回YYYY-MM-DD格式
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取昨天台湾PK10数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

module.exports = router;