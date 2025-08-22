import puppeteer from 'puppeteer-core';
import { createBrowser } from '../puppeteer.config.js';

export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;
  
  try {
    // 检查当前是否在台湾PK10开奖时间段内（台湾时间09:00-23:59）
    const now = new Date();
    const taiwanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
    const currentHour = taiwanTime.getHours();
    
    if (currentHour < 9 || currentHour >= 24) {
      const mockNumbers = Array.from({length: 10}, () => Math.floor(Math.random() * 10) + 1);
      const mockPeriod = '114047' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      
      return new Response(JSON.stringify({
         time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
         period: mockPeriod,
         numbers: mockNumbers,
         numbersString: mockNumbers.join(','),
         timestamp: Date.now(),
         source: 'off-hours-mock',
         type: 'taiwan-pk10',
         message: `当前时间${taiwanTime.getHours()}:${taiwanTime.getMinutes().toString().padStart(2, '0')}不在开奖时间段内（09:00-23:59），返回模拟数据`
       }), {
         status: 200,
         headers: {
           'Content-Type': 'application/json',
           'Access-Control-Allow-Origin': '*',
           'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
           'Access-Control-Allow-Headers': 'Content-Type'
         }
       });
    }
    
    console.log('检查网站数据可用性...');
    
    // 启动浏览器
    browser = await createBrowser(puppeteer);
    
    const page = await browser.newPage();
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // 确定要访问的URL（凌晨时间获取前一天数据）
    let targetUrl = 'https://www.apigx.cn/history/code/twbg.html';
    
    // 如果是凌晨时间（0-7点），尝试获取前一天的数据
    if (currentHour >= 0 && currentHour < 7) {
      const yesterday = new Date(taiwanTime);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      targetUrl = `https://www.apigx.cn/history/code/twbg.html?date=${yesterdayStr}`;
      console.log(`凌晨时间，尝试获取前一天数据: ${yesterdayStr}`);
    }
    
    // 访问网站检查数据可用性
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 25000
    });
    
    // 等待页面加载完成
    await page.waitForTimeout(3000);
    
    // 获取表格数据
    const tableData = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const data = [];
      
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 3) {
          const period = cells[0].textContent.trim();
          const numbersText = cells[1].textContent.trim();
          const time = cells[2].textContent.trim();
          
          // 解析开奖号码（从长字符串中提取前10个数字）
          const numbers = [];
          for (let i = 0; i < numbersText.length && numbers.length < 10; i += 2) {
            const num = parseInt(numbersText.substr(i, 2));
            if (num >= 1 && num <= 10) {
              numbers.push(num);
            }
          }
          
          if (numbers.length === 10) {
            data.push({
              period,
              numbers,
              time,
              numbersText
            });
          }
        }
      });
      
      return data;
    });
    
    console.log(`获取到 ${tableData.length} 条数据`);
    
    if (tableData.length === 0) {
      throw new Error('未获取到有效的开奖数据');
    }
    
    // 取最新的一条数据
    const latestData = tableData[0];
    
    if (!latestData || !latestData.numbers || latestData.numbers.length !== 10) {
      throw new Error('无法解析到有效的开奖数据');
    }
    
    // 格式化返回数据
    const formattedData = {
      time: latestData.time,
      period: latestData.period,
      numbers: latestData.numbers,
      numbersString: latestData.numbers.join(','),
      timestamp: Date.now(),
      source: targetUrl,
      type: 'taiwan-pk10',
      rawNumbersText: latestData.numbersText
    };
    
    return res.status(200).json(formattedData);
    
  } catch (error) {
    console.error('数据获取失败:', error.message);
    
    // 返回模拟数据
    const mockNumbers = Array.from({length: 10}, () => Math.floor(Math.random() * 10) + 1);
    const mockPeriod = '114047' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    return res.status(200).json({
      time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      period: mockPeriod,
      numbers: mockNumbers,
      numbersString: mockNumbers.join(','),
      timestamp: Date.now(),
      source: 'mock-data',
      type: 'taiwan-pk10',
      error: '数据源暂时不可用，返回模拟数据: ' + error.message
    });
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}