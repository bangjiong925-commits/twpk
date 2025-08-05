// Vercel Serverless Function for Stats API
const { createClient } = require('@vercel/kv');

// 初始化KV存储
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: '不支持的HTTP方法'
    });
  }

  try {
    // 获取所有密钥记录
    const keyRecordKeys = await kv.keys('keyRecord:*');
    const usedNonceKeys = await kv.keys('usedNonce:*');
    
    let activeKeys = 0;
    let expiredKeys = 0;
    const now = new Date();
    
    // 统计密钥状态
    for (const key of keyRecordKeys) {
      const record = await kv.get(key);
      if (record) {
        const recordData = JSON.parse(record);
        const expiresAt = new Date(recordData.expiresAt);
        
        if (expiresAt > now) {
          activeKeys++;
        } else {
          expiredKeys++;
        }
      }
    }
    
    const totalKeyRecords = keyRecordKeys.length;
    const totalUsedNonces = usedNonceKeys.length;
    
    return res.status(200).json({
      success: true,
      stats: {
        totalKeyRecords,
        totalUsedNonces,
        activeKeys,
        expiredKeys,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('统计API错误:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
};