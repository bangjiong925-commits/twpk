import TaiwanPK10Data from '../models/TaiwanPK10Data.js';
import mongoose from 'mongoose';

// 确保数据库连接
if (!mongoose.connection.readyState) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
}

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '方法不允许' });
  }

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
      return res.status(200).send(txtData);
    } else {
      // 返回JSON格式
      const jsonData = data.map(item => ({
        period: item.period,
        drawNumbers: item.drawNumbers,
        drawDate: item.drawDate,
        drawTime: item.drawTime,
        scrapedAt: item.scrapedAt
      }));
      
      return res.status(200).json({
        success: true,
        count: jsonData.length,
        data: jsonData
      });
    }

  } catch (error) {
    console.error('获取数据库数据失败:', error);
    return res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message 
    });
  }
}

// 用于本地开发的Express路由
if (typeof module !== 'undefined' && module.exports) {
  module.exports = async (req, res) => {
    return handler(req, res);
  };
}