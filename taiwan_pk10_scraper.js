// 台湾PK10开奖数据抓取脚本
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class TaiwanPK10Scraper {
    constructor() {
        this.url = 'https://xn--kpro5poukl1g.com/#/';
        this.dataFile = path.join(__dirname, 'taiwan_pk10_data.json');
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
            
            // 点击台湾PK10选项
            try {
                await page.click('text=台湾PK10');
                await page.waitForTimeout(2000);
            } catch (error) {
                console.log('点击台湾PK10选项失败，尝试其他方式');
            }
            
            // 提取页面文本内容
            const pageText = await page.evaluate(() => {
                return document.body.innerText;
            });
            
            // 解析最新开奖数据
            const latestData = this.parseLatestPK10Data(pageText);
            
            if (latestData) {
                console.log('成功获取台湾PK10最新开奖数据:', latestData);
                await this.saveData(latestData);
                return latestData;
            } else {
                console.log('未找到台湾PK10开奖数据');
                return null;
            }
            
        } catch (error) {
            console.error('抓取台湾PK10数据时出错:', error);
            return null;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    
    parseLatestPK10Data(text) {
        try {
            // 从文本中提取台湾PK10开奖信息
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);
            
            // 查找台湾PK10部分
            let pk10SectionIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('台湾PK10')) {
                    pk10SectionIndex = i;
                    break;
                }
            }
            
            if (pk10SectionIndex === -1) {
                return null;
            }
            
            // 从台湾PK10部分开始查找数据
            const pk10Lines = lines.slice(pk10SectionIndex);
            
            for (let i = 0; i < pk10Lines.length - 12; i++) {
                const line = pk10Lines[i];
                
                // 查找时间格式的行 (HH:MM)
                if (line.match(/^\d{2}:\d{2}$/)) {
                    const timeLine = line;
                    const periodLine = pk10Lines[i + 1];
                    
                    // 检查期号是否为9位数字
                    if (periodLine && periodLine.match(/^\d{9}$/)) {
                        // 接下来的10行应该是开奖号码
                        const numbers = [];
                        for (let j = 2; j <= 11; j++) {
                            const numberLine = pk10Lines[i + j];
                            if (numberLine && numberLine.match(/^\d+$/) && parseInt(numberLine) >= 1 && parseInt(numberLine) <= 10) {
                                numbers.push(numberLine);
                            } else {
                                break;
                            }
                        }
                        
                        if (numbers.length === 10) {
                            return {
                                time: timeLine,
                                period: periodLine,
                                numbers: numbers,
                                numbersString: numbers.join(' '),
                                timestamp: new Date().toISOString(),
                                source: 'taiwan_pk10',
                                type: 'pk10'
                            };
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('解析台湾PK10数据时出错:', error);
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
            
            if (existingIndex !== -1) {
                // 更新现有数据
                existingData[existingIndex] = data;
                console.log(`更新期号 ${data.period} 的数据`);
            } else {
                // 添加新数据到开头
                existingData.unshift(data);
                console.log(`添加新期号 ${data.period} 的数据`);
            }
            
            // 保留最近100期数据
            if (existingData.length > 100) {
                existingData = existingData.slice(0, 100);
            }
            
            // 保存历史数据（数组格式）
            fs.writeFileSync(this.dataFile, JSON.stringify(existingData, null, 2));
            console.log(`历史数据已保存到 ${this.dataFile}`);
            
            // 同时保存最新数据为单个对象格式（用于TWPK.html自动获取）
            const latestDataFile = path.join(__dirname, 'taiwan_pk10_latest.json');
            // 转换numbers数组为数字类型，以匹配TWPK.html的期望格式
            const latestData = {
                ...data,
                numbers: data.numbers.map(n => parseInt(n, 10))
            };
            fs.writeFileSync(latestDataFile, JSON.stringify(latestData, null, 2));
            console.log(`最新数据已保存到 ${latestDataFile}`);
            
        } catch (error) {
            console.error('保存数据时出错:', error);
        }
    }
    
    async getLatestData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const fileContent = fs.readFileSync(this.dataFile, 'utf8');
                const data = JSON.parse(fileContent);
                return data.length > 0 ? data[0] : null;
            }
            return null;
        } catch (error) {
            console.error('读取最新数据时出错:', error);
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
            console.error('读取所有数据时出错:', error);
            return [];
        }
    }
}

// 主函数
async function main() {
    const scraper = new TaiwanPK10Scraper();
    
    console.log('开始抓取台湾PK10开奖数据...');
    const result = await scraper.scrapeLatestData();
    
    if (result) {
        console.log('抓取完成!');
        console.log('最新数据:', result);
    } else {
        console.log('抓取失败');
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = TaiwanPK10Scraper;