import express from 'express';
const router = express.Router();

// 台湾PK10基础API
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      message: '台湾PK10 API运行正常',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/taiwan-pk10',
        '/api/taiwan-pk10-data',
        '/api/taiwan-pk10-live'
      ]
    });
  } catch (error) {
    console.error('台湾PK10 API错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

export default router;