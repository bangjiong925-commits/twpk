const express = require('express');
const KeyRecord = require('../models/KeyRecord');
const router = express.Router();

// 获取所有密钥记录
router.get('/', async (req, res) => {
  try {
    // 获取所有密钥记录，按使用时间排序（最新的在前）
    const records = await KeyRecord.find({})
      .sort({ usedAt: -1 })
      .lean();
    
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
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 创建新的密钥记录
router.post('/', async (req, res) => {
  try {
    const { keyId, deviceId, usedAt, expiresAt, userAgent, ipAddress, nonce } = req.body;
    
    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的keyId字段'
      });
    }
    
    // 检查密钥是否已被使用
    const existingRecord = await KeyRecord.findOne({ keyId });
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
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000),
      used: true,
      verified: true
    };
    
    const record = new KeyRecord(recordData);
    await record.save();
    
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
router.get('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const record = await KeyRecord.findOne({ keyId });
    
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

// 删除密钥记录
router.delete('/:keyId', async (req, res) => {
  try {
    const { keyId } = req.params;
    const result = await KeyRecord.deleteOne({ keyId });
    
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