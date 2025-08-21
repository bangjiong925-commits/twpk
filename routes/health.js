const express = require('express');
const router = express.Router();

// 健康检查路由
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      status: 'healthy',
      message: '密钥验证服务运行正常',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('健康检查错误:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: '服务器内部错误',
      details: error.message
    });
  }
});

module.exports = router;