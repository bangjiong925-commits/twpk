// Vercel Serverless Function for Nonce Mark API
const { createClient } = require('@vercel/kv');

// 初始化KV存储
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: '不支持的HTTP方法'
    });
  }

  try {
    const { nonce } = req.body;
    
    if (!nonce) {
      return res.status(400).json({
        success: false,
        error: '缺少nonce字段'
      });
    }

    // 检查nonce是否已被标记
    const existingNonce = await kv.get(`usedNonce:${nonce}`);
    if (existingNonce) {
      return res.status(409).json({
        success: false,
        error: 'nonce已被使用',
        nonce: nonce
      });
    }

    // 标记nonce为已使用，设置7天TTL
    const markData = {
      nonce: nonce,
      markedAt: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown'
    };
    
    await kv.setex(`usedNonce:${nonce}`, 7 * 24 * 60 * 60, JSON.stringify(markData));
    
    return res.status(200).json({
      success: true,
      message: 'nonce已标记为已使用',
      nonce: nonce,
      markedAt: markData.markedAt
    });
    
  } catch (error) {
    console.error('Nonce标记错误:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
};