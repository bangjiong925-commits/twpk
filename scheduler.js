const cron = require('node-cron');
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const TaiwanPK10Data = require('./models/TaiwanPK10Data');
require('dotenv').config();

class DataScheduler {
  constructor() {
    this.browser = null;
    this.isRunning = false;
    this.currentTask = null;
    this.dailyCleanupTask = null;
  }

  async init() {
    try {
      // 连接数据库
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
      console.log('数据库连接成功');

      // 启动浏览器
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('浏览器启动成功');

      this.startScheduler();
    } catch (error) {
      console.error('初始化失败:', error);
      process.exit(1);
    }
  }

  startScheduler() {
    // 每5分钟执行一次数据抓取（仅在7:05-23:59之间）
    this.currentTask = cron.schedule('*/5 * * * *', async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // 检查时间范围：7:05-23:59
      if (hour < 7 || (hour === 7 && minute < 5) || hour >= 24) {
        console.log(`当前时间 ${hour}:${minute.toString().padStart(2, '0')} 不在抓取时间范围内`);
        return;
      }

      if (this.isRunning) {
        console.log('数据抓取正在进行中，跳过本次执行');
        return;
      }

      try {
        this.isRunning = true;
        console.log(`开始执行数据抓取 - ${now.toLocaleString()}`);
        await this.scrapeData();
        console.log(`数据抓取完成 - ${new Date().toLocaleString()}`);
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
    console.log('数据抓取时间：每天7:05-23:59，每5分钟一次');
    console.log('数据清理时间：每天凌晨1:00');
  }

  async scrapeData() {
    if (!this.browser) {
      throw new Error('浏览器未初始化');
    }

    const page = await this.browser.newPage();
    
    try {
      // 设置页面
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      
      // 导航到目标页面
      await page.goto('https://www.twpk10.com/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 选择台湾PK10
      await page.waitForSelector('.game-list', { timeout: 10000 });
      const taiwanPK10Link = await page.$('a[href*="taiwan"]');
      if (taiwanPK10Link) {
        await taiwanPK10Link.click();
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
      }

      // 获取今天的数据
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      
      await this.scrapePageData(page, dateStr);
      
    } finally {
      await page.close();
    }
  }

  async scrapePageData(page, dateStr) {
    try {
      // 等待数据表格加载
      await page.waitForSelector('.lottery-table, .data-table, table', { timeout: 10000 });
      
      // 抓取数据
      const data = await page.evaluate(() => {
        const rows = document.querySelectorAll('tr');
        const results = [];
        
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const period = cells[0]?.textContent?.trim();
            const numbersText = cells[1]?.textContent?.trim();
            const timeText = cells[2]?.textContent?.trim();
            
            if (period && numbersText && timeText) {
              // 解析开奖号码
              const numbers = numbersText.split(/[\s,]+/).map(n => parseInt(n)).filter(n => !isNaN(n));
              
              if (numbers.length >= 10) {
                // 处理1和0合并为10的逻辑
                const processedNumbers = [];
                for (let i = 0; i < numbers.length; i++) {
                  if (numbers[i] === 1 && i + 1 < numbers.length && numbers[i + 1] === 0) {
                    processedNumbers.push(10);
                    i++; // 跳过下一个0
                  } else {
                    processedNumbers.push(numbers[i]);
                  }
                }
                
                if (processedNumbers.length === 10) {
                  results.push({
                    period,
                    numbers: processedNumbers,
                    time: timeText
                  });
                }
              }
            }
          }
        }
        
        return results;
      });
      
      // 保存数据到数据库
      let savedCount = 0;
      for (const item of data) {
        try {
          const drawDate = new Date();
          
          const existingData = await TaiwanPK10Data.findOne({ period: item.period });
          if (!existingData) {
            await TaiwanPK10Data.create({
              period: item.period,
              drawNumbers: item.numbers,
              drawDate: drawDate,
              drawTime: item.time,
              dataSource: 'auto-scraper'
            });
            savedCount++;
          }
        } catch (error) {
          console.error(`保存数据失败 (期号: ${item.period}):`, error.message);
        }
      }
      
      console.log(`抓取到 ${data.length} 条数据，新保存 ${savedCount} 条`);
      
    } catch (error) {
      console.error('抓取页面数据失败:', error);
      throw error;
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
    
    if (this.browser) {
      this.browser.close();
      console.log('浏览器已关闭');
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
if (require.main === module) {
  scheduler.init().catch(console.error);
}

module.exports = DataScheduler;