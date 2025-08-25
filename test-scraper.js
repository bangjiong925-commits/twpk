// 测试抓取脚本
import TaiwanPK10Scraper from './auto-scraper.js';

async function testScraper() {
  console.log('开始测试抓取脚本...');
  
  const scraper = new TaiwanPK10Scraper();
  
  try {
    const result = await scraper.run();
    console.log('抓取结果:', result);
  } catch (error) {
    console.error('抓取失败:', error);
  }
}

testScraper();