const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }
    
    // 获取最近3天的日期
    const today = new Date();
    const dates = [];
    
    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.getFullYear().toString() + 
                     String(date.getMonth() + 1).padStart(2, '0') + 
                     String(date.getDate()).padStart(2, '0');
      dates.push(dateStr);
    }
    
    // 查找最新的数据文件
    let latestData = null;
    let latestDate = null;
    
    for (const date of dates) {
      const filePath = path.join(process.cwd(), `${date}.txt`);
      
      if (fs.existsSync(filePath)) {
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          latestData = data;
          latestDate = date;
          break;
        } catch (error) {
          console.error(`读取文件 ${filePath} 失败:`, error);
        }
      }
    }
    
    if (!latestData) {
      res.status(404).json({ 
        error: '未找到最新数据文件',
        searchedDates: dates
      });
      return;
    }
    
    // 返回数据
    res.status(200).json({
      success: true,
      date: latestDate,
      data: latestData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('API错误:', error);
    res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message 
    });
  }
};