const express = require('express');
const mongoose = require('mongoose');
const KeyRecord = require('../models/KeyRecord');
const router = express.Router();

// 数据库连接检查中间件
const checkDatabaseConnection = (req, res, next) => {
  if (!global.dbAvailable || mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable',
      message: '数据库服务暂时不可用，请稍后重试',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// 数据库操作超时处理函数
const withTimeout = (promise, timeoutMs = 15000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database operation timeout')), timeoutMs)
    )
  ]);
};

// 数据库操作重试机制
const withRetry = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(operation());
    } catch (error) {
      lastError = error;
      console.log(`数据库操作失败，尝试 ${attempt}/${maxRetries}:`, error.message);
      
      // 如果是最后一次尝试，直接抛出错误
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // 如果是连接错误，等待后重试
      if (error.name === 'MongoNetworkError' || 
          error.name === 'MongooseServerSelectionError' ||
          error.message === 'Database operation timeout') {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      } else {
        // 其他错误直接抛出，不重试
        throw error;
      }
    }
  }
};

// 获取所有密钥记录
router.get('/', checkDatabaseConnection, async (req, res) => {
  try {
    // 获取所有密钥记录，按使用时间排序（最新的在前）
    const records = await withRetry(() => 
      KeyRecord.find({})
        .sort({ usedAt: -1 })
        .lean()
    );
    
    // 格式化记录以匹配管理界面需求
    const formattedRecords = records.map(record => ({
      keyId: record.keyId,
      nonce: record.nonce,
      usedAt: record.usedAt,
      expiryTime: record.expiresAt,
      deviceInfo: {
        platform: record.deviceId || 'Unknown',
        userAgent: record.deviceInfo || record.userAgent || 'Unknown'
      },
      ipAddress: record.ipAddress || 'N/A',
      used: record.used,
      verified: record.verified,
      remainingTime: Math.max(0, new Date(record.expiresAt) - new Date())
    }));
    
    res.json(formattedRecords);
    
  } catch (error) {
    console.error('获取密钥记录错误:', error);
    
    if (error.message === 'Database operation timeout') {
      return res.status(504).json({
        success: false,
        error: 'Database timeout',
        message: '数据库操作超时，请稍后重试'
      });
    }
    
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 创建新的密钥记录
router.post('/', checkDatabaseConnection, async (req, res) => {
  try {
    const { keyId, deviceId, usedAt, expiresAt, expiryTime, userAgent, ipAddress, nonce } = req.body;
    
    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的keyId字段'
      });
    }
    
    // 检查密钥是否已被使用
    const existingRecord = await withRetry(() => 
      KeyRecord.findOne({ keyId })
    );
    if (existingRecord) {
      return res.status(409).json({
        success: false,
        error: '密钥已被使用',
        record: existingRecord
      });
    }
    
    // 创建新记录
    const recordData = {
      keyId,
      deviceId: deviceId || 'unknown',
      deviceInfo: userAgent || 'unknown',
      userAgent: userAgent || 'unknown',
      ipAddress: ipAddress || req.ip || 'N/A',
      nonce: nonce,
      usedAt: usedAt ? new Date(usedAt) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : (expiryTime ? new Date(expiryTime) : new Date(Date.now() + 24 * 60 * 60 * 1000)),
      used: true,
      verified: true
    };
    
    const record = new KeyRecord(recordData);
    await withRetry(() => record.save());
    
    res.status(201).json({
      success: true,
      message: '密钥记录已保存',
      record: record
    });
    
  } catch (error) {
    console.error('创建密钥记录错误:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: '密钥已存在'
      });
    }
    
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 根据keyId获取特定记录
router.get('/:keyId', checkDatabaseConnection, async (req, res) => {
  try {
    const { keyId } = req.params;
    const record = await withRetry(() => 
      KeyRecord.findOne({ keyId })
    );
    
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '密钥记录未找到'
      });
    }
    
    res.json({
      success: true,
      record: record
    });
    
  } catch (error) {
    console.error('获取密钥记录错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 检查nonce是否已被使用
router.get('/check/:nonce', checkDatabaseConnection, async (req, res) => {
  try {
    const { nonce } = req.params;
    const record = await withRetry(() => 
      KeyRecord.findOne({ keyId: nonce })
    );
    
    res.json({
      success: true,
      used: !!record,
      message: record ? '密钥已被使用' : '密钥未被使用'
    });
    
  } catch (error) {
    console.error('检查密钥状态错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 标记nonce为已使用
router.post('/mark-used', checkDatabaseConnection, async (req, res) => {
  try {
    const { nonce } = req.body;
    
    if (!nonce) {
      return res.status(400).json({
        success: false,
        error: '缺少nonce参数'
      });
    }
    
    // 检查是否已存在
    const existingRecord = await withRetry(() => 
      KeyRecord.findOne({ keyId: nonce })
    );
    
    if (existingRecord) {
      return res.json({
        success: true,
        message: '密钥已被标记为使用',
        record: existingRecord
      });
    }
    
    // 创建新记录
    const newRecord = new KeyRecord({
      keyId: nonce,
      deviceId: req.headers['user-agent'] || 'unknown',
      deviceInfo: req.headers['user-agent'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
      used: true,
      verified: true
    });
    
    const savedRecord = await withRetry(() => newRecord.save());
    
    res.json({
      success: true,
      message: '密钥已标记为使用',
      record: savedRecord
    });
    
  } catch (error) {
    console.error('标记密钥使用错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 删除密钥记录
router.delete('/:keyId', checkDatabaseConnection, async (req, res) => {
  try {
    const { keyId } = req.params;
    const result = await withRetry(() => 
      KeyRecord.deleteOne({ keyId })
    );
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: '密钥记录未找到'
      });
    }
    
    res.json({
      success: true,
      message: '密钥记录已删除'
    });
    
  } catch (error) {
    console.error('删除密钥记录错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

module.exports = router;