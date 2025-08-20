const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

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
    // 启动浏览器
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });
    
    const page = await browser.newPage();
    
    // 设置用户代理
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // 访问目标网站
    await page.goto('https://1680660.com/', {
      waitUntil: 'networkidle2',
      timeout: 25000
    });
    
    // 等待页面加载完成
    await page.waitForTimeout(3000);
    
    // 获取页面文本内容
    const pageText = await page.evaluate(() => {
      return document.body.innerText;
    });
    
    // 解析开奖数据
    const lines = pageText.split('\n');
    let latestData = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 查找包含期数的行（格式：20241215001 或类似）
      const periodMatch = line.match(/(\d{8}\d{3})/);
      if (periodMatch) {
        const period = periodMatch[1];
        
        // 在接下来的几行中查找开奖号码
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const nextLine = lines[j].trim();
          
          // 查找包含10个数字的行
          const numbersMatch = nextLine.match(/\b(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\s+(\d{1,2})\b/);
          if (numbersMatch) {
            const numbers = [];
            for (let k = 1; k <= 10; k++) {
              numbers.push(parseInt(numbersMatch[k]));
            }
            
            latestData = {
              period: period,
              numbers: numbers,
              timestamp: new Date().toISOString(),
              source: '1680660.com'
            };
            break;
          }
        }
        
        if (latestData) break;
      }
    }
    
    if (!latestData) {
      // 如果没有找到数据，返回模拟数据
      const now = new Date();
      const dateStr = now.getFullYear().toString() + 
                     (now.getMonth() + 1).toString().padStart(2, '0') + 
                     now.getDate().toString().padStart(2, '0');
      
      latestData = {
        period: dateStr + '001',
        numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        timestamp: now.toISOString(),
        source: '1680660.com',
        note: 'Fallback data - actual data not found'
      };
    }
    
    return res.status(200).json(latestData);
    
  } catch (error) {
    console.error('抓取数据时出错:', error);
    
    // 返回错误信息和模拟数据
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                   (now.getMonth() + 1).toString().padStart(2, '0') + 
                   now.getDate().toString().padStart(2, '0');
    
    return res.status(200).json({
      period: dateStr + '001',
      numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      timestamp: now.toISOString(),
      source: '1680660.com',
      error: error.message,
      note: 'Error occurred, returning fallback data'
    });
    
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}