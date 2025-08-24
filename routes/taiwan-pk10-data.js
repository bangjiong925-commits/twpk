const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 动态导入ES模块
let TaiwanPK10Data;

// 台湾PK10数据API
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

    // 获取最近3天的数据
    const data = await TaiwanPK10Data.getLatestData(3);
    
    res.json({
      success: true,
      message: '台湾PK10数据API',
      data: data,
      count: data.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('台湾PK10数据API错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

module.exports = router;