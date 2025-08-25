import express from 'express';
import fs from 'fs/promises';
import path from 'path';
const router = express.Router();

// 获取当天日期字符串 (YYYY-MM-DD)
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取昨天日期字符串 (YYYY-MM-DD)
function getYesterdayDateString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取当天数据文件路径
function getTodayDataFilePath() {
  const today = getTodayDateString();
  return path.join(__dirname, '..', 'data', `taiwan-pk10-${today}.json`);
}

// 获取昨天数据文件路径
function getYesterdayDataFilePath() {
  const yesterday = getYesterdayDateString();
  return path.join(__dirname, '..', 'data', `taiwan-pk10-${yesterday}.json`);
}

// 读取昨天历史数据
async function readYesterdayHistoryData() {
  try {
    const filePath = getYesterdayDataFilePath();
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // 文件不存在或读取失败，返回空数组
    return [];
  }
}

// 从数据库获取昨天的数据
async function getYesterdayDataFromDB() {
  try {
    const { default: TaiwanPK10Data } = await import('../models/TaiwanPK10Data.js');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date(yesterday);
    today.setDate(today.getDate() + 1);
    
    const dbData = await TaiwanPK10Data.find({
      drawDate: {
        $gte: yesterday,
        $lt: today
      }
    }).sort({ period: -1 });
    
    return dbData.map(item => ({
      period: item.period,
      drawNumbers: item.drawNumbers,
      drawDate: item.drawDate,
      drawTime: item.drawTime
    }));
  } catch (error) {
    console.error('获取昨天数据库数据失败:', error);
    return [];
  }
}

// 读取当天历史数据
async function readTodayHistoryData() {
  try {
    const filePath = getTodayDataFilePath();
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // 文件不存在或读取失败，返回空数组
    return [];
  }
}

// 保存数据到当天文件
async function saveTodayData(data) {
  try {
    const filePath = getTodayDataFilePath();
    const dir = path.dirname(filePath);
    
    // 确保目录存在
    await fs.mkdir(dir, { recursive: true });
    
    // 保存数据
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('保存当天数据失败:', error);
    return false;
  }
}

// 台湾PK10实时数据API
router.get('/', async (req, res) => {
  try {
    let dataSource = 'today'; // 记录数据来源
    let historyData = [];
    let dbData = [];
    
    // 读取当天历史数据
    historyData = await readTodayHistoryData();
    
    // 动态导入MongoDB模型
    const { default: TaiwanPK10Data } = await import('../models/TaiwanPK10Data.js');
    
    // 获取数据库中的最新数据（今天的数据）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    dbData = await TaiwanPK10Data.find({
      drawDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).sort({ period: -1 });
    
    // 检查当天是否有数据
    const todayHasData = historyData.length > 0 || dbData.length > 0;
    
    // 如果当天没有数据，尝试加载昨天的数据
    if (!todayHasData) {
      console.log('当天无数据，尝试加载昨天数据...');
      dataSource = 'yesterday';
      
      // 读取昨天历史数据
      historyData = await readYesterdayHistoryData();
      
      // 获取昨天数据库数据
      dbData = await getYesterdayDataFromDB();
    }
    
    // 合并历史数据和数据库数据，去重并按期号排序
    const allData = new Map();
    
    // 添加历史数据
    historyData.forEach(item => {
      if (item.period) {
        allData.set(item.period, item);
      }
    });
    
    // 添加数据库数据
    dbData.forEach(item => {
      const dataItem = {
        period: item.period,
        drawNumbers: item.drawNumbers,
        drawDate: item.drawDate,
        drawTime: item.drawTime
      };
      allData.set(item.period, dataItem);
    });
    
    // 转换为数组并按期号排序
    const sortedData = Array.from(allData.values()).sort((a, b) => {
      return b.period.localeCompare(a.period);
    });
    
    // 检查当天期号连续性（只检查今天的数据）
    const missingPeriods = [];
    const todayDateStr = getTodayDateString().replace(/-/g, ''); // 格式：20250825
    
    // 过滤出今天的数据
    const todayData = sortedData.filter(item => {
      return item.period && item.period.startsWith(todayDateStr);
    });
    
    if (todayData.length > 1) {
      for (let i = 0; i < todayData.length - 1; i++) {
        const currentPeriod = parseInt(todayData[i].period);
        const nextPeriod = parseInt(todayData[i + 1].period);
        
        // 只检查当天期号的连续性
        if (currentPeriod - nextPeriod > 1) {
          for (let p = nextPeriod + 1; p < currentPeriod; p++) {
            const periodStr = p.toString();
            // 确保生成的期号也是今天的
            if (periodStr.startsWith(todayDateStr)) {
              missingPeriods.push(periodStr);
            }
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: '台湾PK10实时数据API',
      data: sortedData,
      history_count: historyData.length,
      db_count: dbData.length,
      total_count: sortedData.length,
      missing_periods: missingPeriods,
      dataSource: dataSource,
      dataDate: dataSource === 'today' ? getTodayDateString() : getYesterdayDateString(),
      today_date: getTodayDateString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('台湾PK10实时数据API错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

// 保存数据到当天文件的API
router.post('/save', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: '无效的数据格式'
      });
    }
    
    // 读取现有数据
    const existingData = await readTodayHistoryData();
    const dataMap = new Map();
    
    // 添加现有数据
    existingData.forEach(item => {
      if (item.period) {
        dataMap.set(item.period, item);
      }
    });
    
    // 添加新数据
    data.forEach(item => {
      if (item.period) {
        dataMap.set(item.period, item);
      }
    });
    
    // 转换为数组并排序
    const mergedData = Array.from(dataMap.values()).sort((a, b) => {
      return b.period.localeCompare(a.period);
    });
    
    // 保存到文件
    const saved = await saveTodayData(mergedData);
    
    res.json({
      success: saved,
      message: saved ? '数据保存成功' : '数据保存失败',
      saved_count: mergedData.length,
      today_date: getTodayDateString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('保存数据API错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      details: error.message
    });
  }
});

export default router;