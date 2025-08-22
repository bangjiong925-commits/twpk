// Vercel Serverless Function for Key Verification API
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  // 只允许POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: '只支持POST请求'
    });
  }

  try {
    // 连接数据库
    await connectToDatabase();

    const { keyId, deviceId, userAgent, ipAddress, nonce } = req.body;
    
    // 验证必要字段
    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要的keyId字段'
      });
    }

    // 解码密钥以获取实际的过期时间
    let keyData = null;
    let actualExpiresAt = null;
    
    try {
      // 解码base64密钥
      const decodedKey = atob(keyId);
      keyData = JSON.parse(decodedKey);
      
      // 从密钥中提取过期时间（Unix时间戳转换为Date对象）
      if (keyData.expiry) {
        actualExpiresAt = new Date(keyData.expiry * 1000);
        
        // 检查密钥是否已过期
        if (actualExpiresAt <= new Date()) {
          return res.status(400).json({
            success: false,
            error: '密钥已过期'
          });
        }
      }
    } catch (decodeError) {
      console.error('密钥解码失败:', decodeError);
      return res.status(400).json({
        success: false,
        error: '无效的密钥格式'
      });
    }

    // 检查密钥是否已被使用
    const existingRecord = await KeyRecord.findOne({ keyId });
    
    if (existingRecord) {
      return res.status(409).json({
        success: false,
        error: '密钥已被使用',
        record: {
          keyId: existingRecord.keyId,
          usedAt: existingRecord.usedAt,
          expiresAt: existingRecord.expiresAt,
          deviceInfo: existingRecord.deviceInfo,
          remainingTime: Math.max(0, existingRecord.expiresAt - new Date())
        }
      });
    }

    // 创建新的密钥记录
    const now = new Date();
    // 使用从密钥中解码的实际过期时间，如果解码失败则使用默认的24小时
    const expiresAt = actualExpiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const recordData = {
      keyId,
      deviceId: deviceId || 'web-client',
      deviceInfo: userAgent || 'Unknown Browser',
      userAgent: userAgent || 'Unknown',
      ipAddress: ipAddress || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'N/A',
      nonce: nonce || `nonce_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      usedAt: now,
      expiresAt: expiresAt,
      used: true,
      verified: true
    };

    const record = new KeyRecord(recordData);
    await record.save();

    return res.status(201).json({
      success: true,
      message: '密钥验证成功，已记录使用信息',
      record: {
        keyId: record.keyId,
        usedAt: record.usedAt,
        expiresAt: record.expiresAt,
        deviceInfo: record.deviceInfo,
        remainingTime: Math.max(0, record.expiresAt - new Date())
      }
    });

  } catch (error) {
    console.error('密钥验证API错误:', error);
    
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