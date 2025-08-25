import cron from 'node-cron';
import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
dotenv.config();

const execAsync = promisify(exec);

class DataScheduler {
  constructor() {
    this.isRunning = false;
    this.currentTask = null;
    this.dailyCleanupTask = null;
  }

  async scrapeData() {
    try {
      // 执行数据抓取
      const result = await execAsync('node auto-scraper.js');
      console.log('抓取完成:', result.stdout);
      
      // 将抓取的数据保存到数据库
      console.log('开始保存数据到数据库...');
      const saveResult = await execAsync('node save-to-database.mjs');
      console.log('数据库保存完成:', saveResult.stdout);
      
      return { scrape: result, save: saveResult };
    } catch (error) {
      console.error('抓取或保存失败:', error.message);
      throw error;
    }
  }

  async init() {
    try {
      // 连接数据库
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10');
      console.log('数据库连接成功');

      this.startScheduler();
    } catch (error) {
      console.error('初始化失败:', error);
      process.exit(1);
    }
  }

  startScheduler() {
    // 每分钟检查一次，在开奖时间后1分15秒执行抓取
    this.currentTask = cron.schedule('* * * * *', async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const second = now.getSeconds();
      
      // 检查时间范围：7:05-23:59
      if (hour < 7 || (hour === 7 && minute < 5) || hour >= 24) {
        return;
      }

      // 计算是否为开奖后倒计时75秒的时间点
      // 开奖时间：每5分钟的第5秒（如7:05:05, 7:10:05, 7:15:05等）
      // 抓取时间：开奖后75秒（如7:06:20, 7:11:20, 7:16:20等）
      const isTargetMinute = minute % 5 === 1; // 检查是否为开奖后1分钟
      const isTargetSecond = second >= 15 && second <= 25; // 在15-25秒之间执行（75秒后的时间窗口）
      const isDrawTime = isTargetMinute && isTargetSecond;
      
      // 每分钟的第0秒和目标时间窗口打印调试信息
      if (second === 0 || (isTargetMinute && second >= 15 && second <= 25)) {
        console.log(`时间检查: ${hour}:${minute}:${second}, 目标分钟: ${isTargetMinute}, 目标秒: ${isTargetSecond}, 触发: ${isDrawTime}`);
      }
      
      if (!isDrawTime) {
        return;
      }

      if (this.isRunning) {
        console.log('数据抓取正在进行中，跳过本次执行');
        return;
      }

      try {
        this.isRunning = true;
        console.log(`开始抓取数据 - ${hour}:${minute}:${second}`);
        await this.scrapeData();
      } catch (error) {
        console.error('数据抓取失败:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    // 每天凌晨1点清理7天前的数据
    this.dailyCleanupTask = cron.schedule('0 1 * * *', async () => {
      try {
        console.log('开始清理7天前的数据');
        const result = await TaiwanPK10Data.cleanOldData();
        console.log(`清理完成，删除了 ${result.deletedCount} 条记录`);
      } catch (error) {
        console.error('数据清理失败:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Shanghai'
    });

    console.log('定时任务已启动');
    console.log('数据抓取时间：每天7:05-23:59，每期开奖后倒计时75秒执行');
    console.log('数据清理时间：每天凌晨1:00');
    
    // 启动时立即抓取一次数据
    console.log('启动时立即抓取数据...');
    this.scrapeData().then(() => {
      console.log('启动抓取完成');
    }).catch(error => {
      console.error('启动抓取失败:', error.message);
    });
  }

  async scrapeData() {
    try {
      console.log('开始抓取数据...');
      
      // 调用现有的抓取脚本
      const { stdout, stderr } = await execAsync('node auto-scraper.js');
      
      if (stderr) {
        console.error('抓取脚本错误:', stderr);
      } else {
        console.log('抓取完成:', stdout);
      }
      
    } catch (error) {
      console.error('抓取数据失败:', error);
    }
  }



  stop() {
    if (this.currentTask) {
      this.currentTask.stop();
      console.log('数据抓取任务已停止');
    }
    
    if (this.dailyCleanupTask) {
      this.dailyCleanupTask.stop();
      console.log('数据清理任务已停止');
    }
  }

  async gracefulShutdown() {
    console.log('正在优雅关闭调度器...');
    this.stop();
    await mongoose.connection.close();
    console.log('调度器已关闭');
    process.exit(0);
  }
}

// 创建调度器实例
const scheduler = new DataScheduler();

// 处理进程信号
process.on('SIGINT', () => scheduler.gracefulShutdown());
process.on('SIGTERM', () => scheduler.gracefulShutdown());

// 启动调度器
// 检查是否为直接运行
if (import.meta.url.startsWith('file:') && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  scheduler.init().catch(console.error);
}

export default DataScheduler;