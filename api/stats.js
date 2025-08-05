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
    
    let verifiedKeys = 0;
    let usedKeys = 0;
    let todayKeys = 0;
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 统计密钥状态
    for (const key of keyRecordKeys) {
      const record = await kv.get(key);
      if (record) {
        const recordData = JSON.parse(record);
        const expiresAt = new Date(recordData.expiresAt);
        const usedAt = new Date(recordData.usedAt);
        
        // 统计已验证的密钥（未过期的）
        if (expiresAt > now) {
          verifiedKeys++;
        }
        
        // 统计今日验证的密钥
        if (usedAt >= today && usedAt < tomorrow) {
          todayKeys++;
        }
      }
    }
    
    const totalKeys = keyRecordKeys.length;
    usedKeys = usedNonceKeys.length;
    
    return res.status(200).json({
      totalKeys,
      verifiedKeys,
      usedKeys,
      todayKeys
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