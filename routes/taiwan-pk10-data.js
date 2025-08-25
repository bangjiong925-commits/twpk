import express from 'express';
import mongoose from 'mongoose';
const router = express.Router();

// 动态导入ES模块
let TaiwanPK10Data;

// 台湾PK10数据API
router.get('/', async (req, res) => {
  try {
    // 动态导入模型（如果还没有导入）
    if (!TaiwanPK10Data) {
      const module = await import('../models/TaiwanPK10Data.js');
      TaiwanPK10Data = module.default;
    }

    // 检查数据库连接
    if (!global.dbAvailable) {
      return res.status(503).json({
        success: false,
        error: '数据库连接不可用',
        message: '请稍后重试'
      });
    }

    const { days = 3, date, all = false, limit, page, pageSize } = req.query;
    console.log('API查询参数:', { days, date, all, limit, page, pageSize });
    
    let data;
    
    if (all === 'true' || all === true) {
      // 查询所有数据
      console.log('查询所有数据...');
      let query = TaiwanPK10Data.find({}).sort({ period: -1 });
      
      // 处理分页
      if (page && pageSize) {
        const pageNum = parseInt(page);
        const pageSizeNum = parseInt(pageSize);
        const skip = (pageNum - 1) * pageSizeNum;
        query = query.skip(skip).limit(pageSizeNum);
      } else if (limit) {
        const queryLimit = parseInt(limit);
        query = query.limit(queryLimit);
      } else {
        query = query.limit(1000);
      }
      
      data = await query;
      console.log('查询到的数据数量:', data.length);
    } else if (date) {
      // 查询特定日期的数据
      const targetDate = new Date(date);
      data = await TaiwanPK10Data.getDataByDate(targetDate);
      
      // 处理分页或限制
      if (page && pageSize) {
        const pageNum = parseInt(page);
        const pageSizeNum = parseInt(pageSize);
        const start = (pageNum - 1) * pageSizeNum;
        const end = start + pageSizeNum;
        data = data.slice(start, end);
      } else if (limit) {
        const limitNum = parseInt(limit);
        data = data.slice(0, limitNum);
      }
    } else {
      // 获取最近几天的数据
      const daysNum = parseInt(days);
      data = await TaiwanPK10Data.getLatestData(daysNum);
      
      // 处理分页或限制
      if (page && pageSize) {
        const pageNum = parseInt(page);
        const pageSizeNum = parseInt(pageSize);
        const start = (pageNum - 1) * pageSizeNum;
        const end = start + pageSizeNum;
        data = data.slice(start, end);
      } else if (limit) {
        const limitNum = parseInt(limit);
        data = data.slice(0, limitNum);
      }
    }
    
    console.log('最终返回数据数量:', data.length);
    
    // 构建响应对象
    const response = {
      success: true,
      message: '台湾PK10数据API',
      data: data,
      count: data.length,
      timestamp: new Date().toISOString()
    };
    
    // 如果使用了分页，添加分页信息
    if (page && pageSize) {
      const pageNum = parseInt(page);
      const pageSizeNum = parseInt(pageSize);
      response.pagination = {
        currentPage: pageNum,
        pageSize: pageSizeNum,
        hasNextPage: data.length === pageSizeNum,
        hasPrevPage: pageNum > 1
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error('台湾PK10数据API错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

export default router;