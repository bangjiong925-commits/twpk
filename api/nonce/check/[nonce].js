// Vercel Serverless Function for Nonce Check API
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
    const { nonce } = req.query;
    
    if (!nonce) {
      return res.status(400).json({
        success: false,
        error: '缺少nonce参数'
      });
    }

    // 检查nonce是否已被使用
    const usedNonce = await kv.get(`usedNonce:${nonce}`);
    const keyRecord = await kv.get(`keyRecord:${nonce}`);
    
    const isUsed = !!(usedNonce || keyRecord);
    
    return res.status(200).json({
      success: true,
      used: isUsed,
      nonce: nonce
    });
    
  } catch (error) {
    console.error('Nonce检查错误:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
};