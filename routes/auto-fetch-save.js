import express from 'express';
import TaiwanPK10Data from '../models/TaiwanPK10Data.js';
const router = express.Router();

// 自动获取并保存数据到数据库
router.post('/', async (req, res) => {
  try {
    const { period, numbers, drawDate } = req.body;
    
    // 验证数据格式
    if (!period || !numbers || !Array.isArray(numbers) || numbers.length !== 10) {
      return res.status(400).json({
        success: false,
        error: '数据格式无效'
      });
    }
    
    // 检查是否已存在该期号的数据
    const existingData = await TaiwanPK10Data.findOne({ period });
    if (existingData) {
      return res.json({
        success: true,
        message: '数据已存在，无需重复保存',
        period,
        duplicate: true
      });
    }
    
    // 创建新的数据记录
    const newData = new TaiwanPK10Data({
      period,
      drawNumbers: numbers,
      drawDate: drawDate ? new Date(drawDate) : new Date()
    });
    
    // 保存到数据库
    await newData.save();
    
    res.json({
      success: true,
      message: '数据保存成功',
      period,
      duplicate: false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('自动获取保存数据错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

export default router;