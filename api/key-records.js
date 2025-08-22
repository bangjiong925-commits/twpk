// Vercel Serverless Function for Key Records API
const mongoose = require('mongoose');
const KeyRecord = require('../models/KeyRecord');

// MongoDB连接
let isConnected = false;

async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log('MongoDB连接成功');
  } catch (error) {
    console.error('MongoDB连接失败:', error);
    throw error;
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, User-Agent',
};

module.exports = async (req, res) => {
  // 处理CORS预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).json({}).setHeaders(corsHeaders);
  }

  // 设置CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    // 连接数据库
    await connectToDatabase();

    if (req.method === 'GET') {
      // 获取所有密钥记录
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
      
      return res.status(200).json(formattedRecords);
      
    } else if (req.method === 'POST') {
      // 创建新的密钥记录
      const { keyId, deviceId, usedAt, expiresAt, expiryTime, userAgent, ipAddress, nonce } = req.body;
      
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
        ipAddress: ipAddress || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'N/A',
        nonce: nonce,
        usedAt: usedAt ? new Date(usedAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : (expiryTime ? new Date(expiryTime) : new Date(Date.now() + 24 * 60 * 60 * 1000)),
        used: true,
        verified: true
      };
      
      const record = new KeyRecord(recordData);
      await record.save();
      
      return res.status(201).json({
        success: true,
        message: '密钥记录已保存',
        record: record
      });
      
    } else if (req.method === 'DELETE') {
      // 删除密钥记录
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = url.pathname.split('/');
      const keyId = pathParts[pathParts.length - 1];
      
      if (!keyId || keyId === 'key-records') {
        return res.status(400).json({
          success: false,
          error: '缺少keyId参数'
        });
      }
      
      const result = await KeyRecord.deleteOne({ keyId });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: '密钥记录未找到'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: '密钥记录已删除'
      });
      
    } else {
      return res.status(405).json({
        success: false,
        error: '不支持的HTTP方法'
      });
    }
    
  } catch (error) {
    console.error('API错误:', error);
    
    // 处理MongoDB重复键错误
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: '密钥已存在'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};