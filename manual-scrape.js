// 手动触发数据抓取和保存
import { exec } from 'child_process';
import { promisify } from 'util';
import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';
import dotenv from 'dotenv';
dotenv.config();

const execAsync = promisify(exec);

async function manualScrape() {
  try {
    console.log('开始手动数据抓取...');
    
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10');
    console.log('数据库连接成功');
    
    // 执行数据抓取
    console.log('正在抓取数据...');
    const result = await execAsync('node auto-scraper.js');
    console.log('抓取完成:', result.stdout);
    if (result.stderr) {
      console.error('抓取警告:', result.stderr);
    }
    
    // 将抓取的数据保存到数据库
    console.log('开始保存数据到数据库...');
    const saveResult = await execAsync('node save-to-database.mjs');
    console.log('数据库保存完成:', saveResult.stdout);
    if (saveResult.stderr) {
      console.error('保存警告:', saveResult.stderr);
    }
    
    // 检查数据库中的数据
    const today = new Date();
    const todayStr = today.getDate().toString().padStart(2, '0');
    const totalCount = await TaiwanPK10Data.countDocuments();
    const todayCount = await TaiwanPK10Data.countDocuments({
      period: { $regex: `^\\d{6}${todayStr}\\d{3}$` }
    });
    
    console.log(`\n数据库状态:`);
    console.log(`总记录数: ${totalCount}`);
    console.log(`今天(${todayStr}号)的记录数: ${todayCount}`);
    
    if (todayCount > 0) {
      // 显示今天的前5期和后5期数据
      const todayData = await TaiwanPK10Data.find({
        period: { $regex: `^\\d{6}${todayStr}\\d{3}$` }
      }).sort({ period: 1 });
      
      console.log('\n今天的数据范围:');
      console.log('前5期:');
      todayData.slice(0, 5).forEach(item => {
        console.log(`期号: ${item.period}, 开奖号码: ${item.numbers.join(',')}, 时间: ${item.drawTime}`);
      });
      
      if (todayData.length > 5) {
        console.log('\n后5期:');
        todayData.slice(-5).forEach(item => {
          console.log(`期号: ${item.period}, 开奖号码: ${item.numbers.join(',')}, 时间: ${item.drawTime}`);
        });
      }
    }
    
    await mongoose.disconnect();
    console.log('\n手动抓取完成!');
    
  } catch (error) {
    console.error('手动抓取失败:', error);
    process.exit(1);
  }
}

manualScrape();