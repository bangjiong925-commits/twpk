// 台湾宾果开奖数据抓取脚本
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class TaiwanBingoScraper {
    constructor() {
        this.url = 'https://xn--kpro5poukl1g.com/#/';
        this.dataFile = path.join(__dirname, 'lottery_data.json');
    }

    async scrapeLatestData() {
        let browser;
        try {
            browser = await puppeteer.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            
            const page = await browser.newPage();
            await page.goto(this.url, { waitUntil: 'networkidle2' });
            
            // 等待页面加载
            await page.waitForTimeout(3000);
            
            // 提取页面文本内容
            const pageText = await page.evaluate(() => {
                return document.body.innerText;
            });
            
            // 解析最新开奖数据
            const latestData = this.parseLatestData(pageText);
            
            if (latestData) {
                console.log('成功获取最新开奖数据:', latestData);
                await this.saveData(latestData);
                return latestData;
            } else {
                console.log('未找到开奖数据');
                return null;
            }
            
        } catch (error) {
            console.error('抓取数据时出错:', error);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    
    parseLatestData(text) {
        try {
            // 从文本中提取开奖信息
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);
            
            // 查找包含时间格式的行
            for (let i = 0; i < lines.length - 2; i++) {
                const timeLine = lines[i];
                const periodLine = lines[i + 1];
                const numbersLine = lines[i + 2];
                
                // 匹配时间格式 (如 13:10)
                if (timeLine.match(/^\d{2}:\d{2}$/)) {
                    // 匹配期号 (纯数字)
                    if (periodLine.match(/^\d+$/)) {
                        // 匹配开奖号码 (包含数字)
                        if (numbersLine.match(/\d{2}/)) {
                            return {
                                time: timeLine,
                                period: periodLine,
                                numbers: numbersLine,
                                timestamp: new Date().toISOString(),
                                source: 'taiwan_bingo'
                            };
                        }
                    }
                }
            }
            
            // 备用解析方法：查找特定模式
            const periodMatch = text.match(/(\d{9})期开奖/);
            const timeMatch = text.match(/(\d{2}:\d{2})\s*\t\s*(\d{9})\s*\t\s*([\d\s]+)/);
            
            if (timeMatch) {
                return {
                    time: timeMatch[1],
                    period: timeMatch[2],
                    numbers: timeMatch[3].trim(),
                    timestamp: new Date().toISOString(),
                    source: 'taiwan_bingo'
                };
            }
            
            return null;
        } catch (error) {
            console.error('解析数据时出错:', error);
            return null;
        }
    }
    
    async saveData(data) {
        try {
            let existingData = [];
            
            // 读取现有数据
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                existingData = JSON.parse(fileContent);
            }
            
            // 检查是否已存在相同期号的数据
            const existingIndex = existingData.findIndex(item => item.period === data.period);
            
            if (existingIndex >= 0) {
                // 更新现有数据
                existingData[existingIndex] = data;
                console.log(`更新期号 ${data.period} 的数据`);
            } else {
                // 添加新数据
                existingData.unshift(data); // 添加到数组开头
                console.log(`添加新期号 ${data.period} 的数据`);
            }
            
            // 保留最近100期数据
            if (existingData.length > 100) {
                existingData = existingData.slice(0, 100);
            }
            
            // 保存数据
            fs.writeFileSync(this.dataFile, JSON.stringify(existingData, null, 2));
            console.log(`数据已保存到 ${this.dataFile}`);
            
        } catch (error) {
            console.error('保存数据时出错:', error);
        }
    }
    
    async getLatestData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                const data = JSON.parse(fileContent);
                return data[0] || null; // 返回最新的一条数据
            }
            return null;
        } catch (error) {
            console.error('读取数据时出错:', error);
            return null;
        }
    }
    
    async getAllData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                return JSON.parse(fileContent);
            }
            return [];
        } catch (error) {
            console.error('读取数据时出错:', error);
            return [];
        }
    }
}

// 使用示例
async function main() {
    const scraper = new TaiwanBingoScraper();
    
    // 抓取最新数据
    console.log('开始抓取台湾宾果开奖数据...');
    const latestData = await scraper.scrapeLatestData();
    
    if (latestData) {
        console.log('\n=== 最新开奖数据 ===');
        console.log(`开奖时间: ${latestData.time}`);
        console.log(`期号: ${latestData.period}`);
        console.log(`开奖号码: ${latestData.numbers}`);
        console.log(`抓取时间: ${latestData.timestamp}`);
    } else {
        console.log('未能获取到开奖数据');
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = TaiwanBingoScraper;