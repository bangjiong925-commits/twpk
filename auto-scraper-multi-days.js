const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    url: 'https://www.twpk10.com/',
    headless: true,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 2000
};

// 获取指定日期的数据
async function scrapeDataForDate(page, targetDate) {
    console.log(`开始抓取 ${targetDate} 日的数据...`);
    
    try {
        // 点击日期选择器
        await page.waitForSelector('.date-picker', { timeout: CONFIG.timeout });
        await page.click('.date-picker');
        
        // 等待日期选项出现
        await page.waitForSelector('.date-option', { timeout: CONFIG.timeout });
        
        // 选择指定日期
        const dateSelected = await page.evaluate((date) => {
            const options = document.querySelectorAll('.date-option');
            for (let option of options) {
                if (option.textContent.includes(date)) {
                    option.click();
                    return true;
                }
            }
            return false;
        }, targetDate);
        
        if (!dateSelected) {
            console.log(`未找到 ${targetDate} 日的选项`);
            return null;
        }
        
        // 等待数据加载
        await page.waitForTimeout(3000);
        
        // 获取总页数
        const totalPages = await page.evaluate(() => {
            const pageInfo = document.querySelector('.page-info');
            if (pageInfo) {
                const match = pageInfo.textContent.match(/共(\d+)页/);
                return match ? parseInt(match[1]) : 1;
            }
            return 1;
        });
        
        console.log(`${targetDate} 日共有 ${totalPages} 页数据`);
        
        const allRecords = [];
        
        // 抓取每一页的数据
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            console.log(`正在抓取第 ${pageNum}/${totalPages} 页...`);
            
            if (pageNum > 1) {
                // 点击下一页
                await page.click('.next-page');
                await page.waitForTimeout(2000);
            }
            
            // 抓取当前页数据
            const pageRecords = await page.evaluate(() => {
                const records = [];
                const rows = document.querySelectorAll('.data-row');
                
                rows.forEach(row => {
                    const periodElement = row.querySelector('.period');
                    const numbersElement = row.querySelector('.numbers');
                    
                    if (periodElement && numbersElement) {
                        const period = periodElement.textContent.trim();
                        const numbers = numbersElement.textContent.trim();
                        
                        if (period && numbers) {
                            records.push({ period, numbers });
                        }
                    }
                });
                
                return records;
            });
            
            allRecords.push(...pageRecords);
            console.log(`第 ${pageNum} 页抓取到 ${pageRecords.length} 条记录`);
        }
        
        return {
            date: targetDate,
            totalPages,
            totalRecords: allRecords.length,
            records: allRecords
        };
        
    } catch (error) {
        console.error(`抓取 ${targetDate} 日数据时出错:`, error);
        return null;
    }
}

// 格式化开奖号码
function formatNumbers(numbers) {
    try {
        // 移除所有非数字字符
        const cleanNumbers = numbers.replace(/[^0-9]/g, '');
        
        // 处理10的合并逻辑
        let processedNumbers = cleanNumbers;
        
        // 临时替换10为特殊字符
        processedNumbers = processedNumbers.replace(/10/g, 'X');
        
        // 将每个字符分割并用逗号连接
        const formattedArray = processedNumbers.split('').map(char => {
            return char === 'X' ? '10' : char;
        });
        
        return formattedArray.join(',');
    } catch (error) {
        console.error('格式化号码时出错:', error);
        return numbers;
    }
}

// 保存数据为TXT格式
function saveDataAsTxt(dateData) {
    try {
        const fileName = `${dateData.date}.txt`;
        const txtContent = dateData.records.map(record => {
            const formattedNumbers = formatNumbers(record.numbers);
            return `${record.period} ${formattedNumbers}`;
        }).join('\n');
        
        fs.writeFileSync(fileName, txtContent, 'utf8');
        console.log(`已保存 ${fileName}，包含 ${dateData.records.length} 条记录`);
        
        return fileName;
    } catch (error) {
        console.error('保存文件时出错:', error);
        return null;
    }
}

// 主函数
async function main() {
    let browser;
    
    try {
        console.log('启动浏览器...');
        browser = await puppeteer.launch({
            headless: CONFIG.headless,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        console.log('导航到目标网站...');
        await page.goto(CONFIG.url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
        
        // 等待页面加载完成
        await page.waitForTimeout(3000);
        
        // 选择台湾PK10
        await page.waitForSelector('a[href*="twpk10"]', { timeout: CONFIG.timeout });
        await page.click('a[href*="twpk10"]');
        await page.waitForTimeout(3000);
        
        // 要抓取的日期列表（最近3天）
        const today = new Date();
        const targetDates = [];
        
        for (let i = 0; i < 3; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = String(date.getDate()).padStart(2, '0');
            targetDates.push(dateStr);
        }
        
        console.log(`准备抓取日期: ${targetDates.join(', ')}`);
        
        const savedFiles = [];
        
        // 抓取每个日期的数据
        for (const targetDate of targetDates) {
            const dateData = await scrapeDataForDate(page, targetDate);
            
            if (dateData && dateData.records.length > 0) {
                // 生成完整日期格式
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const fullDate = `${year}${month}${targetDate}`;
                
                dateData.date = fullDate;
                
                const fileName = saveDataAsTxt(dateData);
                if (fileName) {
                    savedFiles.push(fileName);
                }
            } else {
                console.log(`${targetDate} 日没有抓取到数据`);
            }
            
            // 等待一下再抓取下一个日期
            await page.waitForTimeout(2000);
        }
        
        console.log('\n=== 抓取完成 ===');
        console.log(`成功保存的文件: ${savedFiles.join(', ')}`);
        
    } catch (error) {
        console.error('抓取过程中出错:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// 执行主函数
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main, scrapeDataForDate, formatNumbers, saveDataAsTxt };