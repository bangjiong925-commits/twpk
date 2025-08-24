const express = require('express');
const TaiwanPK10Data = require('../models/TaiwanPK10Data');
const router = express.Router();

// GET /api/database-data
router.get('/', async (req, res) => {
  try {
    const { days = 3, date, format = 'txt' } = req.query;

    let data;
    
    if (date) {
      // 获取指定日期的数据
      const targetDate = new Date(date);
      data = await TaiwanPK10Data.getDataByDate(targetDate);
    } else {
      // 获取最近几天的数据
      data = await TaiwanPK10Data.getLatestData(parseInt(days));
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: '未找到数据' });
    }

    // 根据格式返回数据
    if (format === 'txt') {
      // 转换为TXT格式
      const txtData = data.map(item => {
        const numbersStr = item.drawNumbers.join(' ');
        return `${item.period} ${numbersStr}`;
      }).join('\n');
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(txtData);
    } else {
      // 返回JSON格式
      return res.json({
        success: true,
        count: data.length,
        data: data
      });
    }
  } catch (error) {
    console.error('获取数据库数据失败:', error);
    return res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message 
    });
  }
});

module.exports = router;