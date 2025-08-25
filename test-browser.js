// 测试浏览器启动
import puppeteer from 'puppeteer-core';
import { promises as fs } from 'fs';

async function testBrowser() {
  try {
    console.log('开始测试浏览器启动...');
    
    const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    
    // 检查Chrome是否存在
    try {
      await fs.access(executablePath);
      console.log('Chrome浏览器路径验证成功');
    } catch (e) {
      console.error('Chrome浏览器路径不存在:', executablePath);
      return;
    }
    
    const launchOptions = {
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--disable-gpu'
      ]
    };
    
    console.log('启动浏览器...');
    const browser = await puppeteer.launch(launchOptions);
    console.log('浏览器启动成功');
    
    const page = await browser.newPage();
    console.log('新页面创建成功');
    
    await page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
    console.log('页面导航成功');
    
    const title = await page.title();
    console.log('页面标题:', title);
    
    await browser.close();
    console.log('浏览器关闭成功');
    
    console.log('浏览器测试完成!');
    
  } catch (error) {
    console.error('浏览器测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testBrowser();