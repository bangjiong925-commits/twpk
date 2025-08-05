// Vercel Serverless Function for Health Check API

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
    return res.status(200).json({
      success: true,
      status: 'healthy',
      message: '密钥验证服务运行正常',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'production'
    });
    
  } catch (error) {
    console.error('健康检查错误:', error);
    return res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: '服务器内部错误',
      details: error.message
    });
  }
};