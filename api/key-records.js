// Vercel Serverless Function for Key Records API
const { createClient } = require('@vercel/kv');

// 初始化KV存储（Vercel的Redis替代方案）
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

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

  try {
    if (req.method === 'GET') {
      // 获取所有密钥记录
      const keyRecordKeys = await kv.keys('keyRecord:*');
      const usedNonceKeys = await kv.keys('usedNonce:*');
      const records = [];
      
      for (const key of keyRecordKeys) {
        const record = await kv.get(key);
        if (record) {
          const recordData = JSON.parse(record);
          const keyId = key.replace('keyRecord:', '');
          
          // 检查是否已使用（通过nonce检查）
          const isUsed = usedNonceKeys.some(nonceKey => {
            const nonce = nonceKey.replace('usedNonce:', '');
            return recordData.nonce === nonce;
          });
          
          // 格式化记录以匹配管理界面需求
          records.push({
            keyId: keyId,
            nonce: recordData.nonce,
            usedAt: recordData.usedAt,
            expiryTime: recordData.expiresAt,
            deviceInfo: {
              platform: recordData.deviceId || 'Unknown',
              userAgent: recordData.deviceInfo || recordData.userAgent || 'Unknown'
            },
            ipAddress: recordData.ipAddress || 'N/A',
            used: isUsed,
            verified: true // 所有记录都是已验证的
          });
        }
      }
      
      // 按使用时间排序（最新的在前）
      records.sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt));
      
      return res.status(200).json(records);
      
    } else if (req.method === 'POST') {
      // 创建新的密钥记录
      const { keyId, deviceId, usedAt, expiresAt, userAgent } = req.body;
      
      if (!keyId) {
        return res.status(400).json({
          success: false,
          error: '缺少必要的keyId字段'
        });
      }
      
      // 检查密钥是否已被使用
      const existingRecord = await kv.get(`keyRecord:${keyId}`);
      if (existingRecord) {
        return res.status(409).json({
          success: false,
          error: '密钥已被使用',
          record: JSON.parse(existingRecord)
        });
      }
      
      // 创建新记录
      const now = new Date().toISOString();
      const record = {
        keyId,
        deviceId: deviceId || 'unknown',
        deviceInfo: userAgent || 'unknown',
        usedAt: usedAt || now,
        expiresAt: expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdTime: now,
        remainingTime: expiresAt ? Math.max(0, new Date(expiresAt) - new Date()) : 24 * 60 * 60 * 1000
      };
      
      // 保存到KV存储，设置7天TTL
      await kv.setex(`keyRecord:${keyId}`, 7 * 24 * 60 * 60, JSON.stringify(record));
      
      return res.status(201).json({
        success: true,
        message: '密钥记录已保存',
        record: record
      });
      
    } else {
      return res.status(405).json({
        success: false,
        error: '不支持的HTTP方法'
      });
    }
    
  } catch (error) {
    console.error('API错误:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
};