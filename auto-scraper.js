// 自动化台湾PK10数据抓取脚本
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TaiwanPK10Scraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.allData = [];
        this.targetDate = new Date().getDate().toString(); // 当天日期
        this.totalPages = 5; // 总页数
    }

    async init() {
        console.log('启动浏览器...');
        
        // 检测运行环境
        const isLocal = process.env.NODE_ENV !== 'production';
        
        let launchOptions;
        if (isLocal) {
            // 本地环境：尝试使用系统Chrome
            const possiblePaths = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/snap/bin/chromium'
            ];
            
            let executablePath = null;
            for (const path of possiblePaths) {
                try {
                    await fs.access(path);
                    executablePath = path;
                    break;
                } catch (e) {
                    // 继续尝试下一个路径
                }
            }
            
            if (!executablePath) {
                throw new Error('未找到Chrome浏览器，请安装Chrome或Chromium');
            }
            
            launchOptions = {
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
        } else {
            // 生产环境：使用chromium
            launchOptions = {
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: await chromium.executablePath(),
                headless: chromium.headless
            };
        }
        
        this.browser = await puppeteer.launch(launchOptions);
        
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1280, height: 800 });
        
        // 设置用户代理
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }

    async navigateToSite() {
        console.log('导航到台湾宾果网站...');
        await this.page.goto('https://xn--kpro5poukl1g.com/#/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        // 等待页面加载完成
        await this.page.waitForTimeout(3000);
    }

    async selectTaiwanPK10() {
        console.log('选择台湾PK10模式...');
        
        try {
            // 查找并点击台湾PK10选项
            await this.page.evaluate(() => {
                const elements = Array.from(document.querySelectorAll('*'));
                for (let element of elements) {
                    if (element.textContent && element.textContent.trim() === '台湾PK10') {
                        console.log('找到台湾PK10选项，准备点击');
                        element.click();
                        return true;
                    }
                }
                return false;
            });
            
            await this.page.waitForTimeout(2000);
            console.log('成功选择台湾PK10模式');
        } catch (error) {
            console.error('选择台湾PK10模式失败:', error);
            throw error;
        }
    }

    async selectDate() {
        console.log(`选择日期: ${this.targetDate}日...`);
        
        try {
            // 点击日期选择器
            await this.page.evaluate(() => {
                const dateElements = Array.from(document.querySelectorAll('*'));
                for (let element of dateElements) {
                    if (element.className && element.className.includes('date')) {
                        element.click();
                        return true;
                    }
                }
                return false;
            });
            
            await this.page.waitForTimeout(1000);
            
            // 选择24日
            await this.page.evaluate((targetDate) => {
                const dateOptions = Array.from(document.querySelectorAll('td'));
                for (let option of dateOptions) {
                    if (option.textContent && option.textContent.trim() === targetDate) {
                        console.log(`找到${targetDate}日，准备点击`);
                        option.click();
                        return true;
                    }
                }
                return false;
            }, this.targetDate);
            
            await this.page.waitForTimeout(3000);
            console.log(`成功选择${this.targetDate}日`);
        } catch (error) {
            console.error('选择日期失败:', error);
            throw error;
        }
    }

    async scrapePageData(pageNum) {
        console.log(`抓取第${pageNum}页数据...`);
        
        try {
            // 等待数据加载
            await this.page.waitForTimeout(2000);
            
            // 抓取当前页面的数据
            const pageData = await this.page.evaluate((pageNum) => {
                const data = {
                    page: pageNum,
                    timestamp: new Date().toISOString(),
                    records: []
                };
                
                // 查找所有表格并抓取数据
                const tables = document.querySelectorAll('table');
                console.log(`找到${tables.length}个表格`);
                
                for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
                    const table = tables[tableIndex];
                    const rows = table.querySelectorAll('tr');
                    console.log(`表格${tableIndex + 1}有${rows.length}行`);
                    
                    if (rows.length > 1) { // 至少要有表头和数据行
                        // 检查第一行是否包含期号相关信息
                        const firstRowText = rows[0].textContent;
                        console.log(`表格${tableIndex + 1}第一行: ${firstRowText}`);
                        
                        // 从第一行开始抓取数据（包含第一行）
                        for (let i = 0; i < rows.length; i++) {
                            const row = rows[i];
                            const cells = row.querySelectorAll('td');
                            
                            if (cells.length >= 2) { // 至少要有两列数据
                                const rowData = {};
                                cells.forEach((cell, cellIndex) => {
                                    rowData[`column_${cellIndex}`] = cell.textContent.trim();
                                });
                                
                                // 查找期号和开奖号码
                                let period = '';
                                let numbers = '';
                                let hasValidData = false;
                                
                                Object.entries(rowData).forEach(([key, value]) => {
                                    // 期号：9位数字
                                    if (value && /^\d{9}$/.test(value)) {
                                        period = value;
                                    }
                                    // 开奖号码：10-11位数字
                                    if (value && /^\d{10,11}$/.test(value)) {
                                        // 处理数字：将连续的'1'和'0'合并为'10'
                                        let processedValue = value.replace(/10/g, 'X'); // 临时替换10为X
                                        let digits = processedValue.split('');
                                        // 将X替换回10
                                        let result = [];
                                        for (let digit of digits) {
                                            if (digit === 'X') {
                                                result.push('10');
                                            } else {
                                                result.push(digit);
                                            }
                                        }
                                        numbers = result.join(',');
                                    }
                                });
                                
                                if (period && numbers) {
                                    hasValidData = true;
                                    // 创建格式化的数据
                                    const formattedData = {
                                        ...rowData,
                                        formatted: `${period} ${numbers}`
                                    };
                                    console.log(`处理数据: 期号=${period}, 开奖号码=${numbers}`);
                                    data.records.push(formattedData);
                                }
                                
                                if (!hasValidData && Object.keys(rowData).length > 0) {
                                    console.log(`跳过无效数据行: ${JSON.stringify(rowData)}`);
                                }
                            }
                        }
                    }
                }
                
                return data;
            }, pageNum);
            
            console.log(`第${pageNum}页抓取到${pageData.records.length}条记录`);
            return pageData;
        } catch (error) {
            console.error(`抓取第${pageNum}页数据失败:`, error);
            return { page: pageNum, error: error.message, records: [] };
        }
    }

    async loadMoreData(pageNum) {
        console.log(`尝试加载第${pageNum + 1}页数据...`);
        
        try {
            // 获取当前数据行数
            const currentRowCount = await this.page.evaluate(() => {
                const tables = document.querySelectorAll('table');
                if (tables.length > 0) {
                    return tables[0].querySelectorAll('tr').length - 1; // 减去表头
                }
                return 0;
            });
            
            console.log(`当前表格行数: ${currentRowCount}`);
            
            // 尝试滚动到页面底部触发加载更多
            await this.page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });
            
            // 等待可能的数据加载
            await this.page.waitForTimeout(2000);
            
            // 尝试查找并点击"加载更多"或类似按钮
            const loadMoreClicked = await this.page.evaluate(() => {
                const buttons = document.querySelectorAll('button, a, [onclick]');
                for (let button of buttons) {
                    const text = button.textContent?.trim().toLowerCase();
                    if (text && (text.includes('加载更多') || text.includes('load more') || 
                               text.includes('更多') || text.includes('more') ||
                               text.includes('下一页') || text.includes('next'))) {
                        console.log(`找到加载更多按钮: ${button.textContent}`);
                        button.click();
                        return true;
                    }
                }
                return false;
            });
            
            if (loadMoreClicked) {
                console.log('点击了加载更多按钮，等待数据加载...');
                await this.page.waitForTimeout(3000);
            }
            
            // 检查是否有新数据加载
            const newRowCount = await this.page.evaluate(() => {
                const tables = document.querySelectorAll('table');
                if (tables.length > 0) {
                    return tables[0].querySelectorAll('tr').length - 1;
                }
                return 0;
            });
            
            console.log(`加载后表格行数: ${newRowCount}`);
            
            if (newRowCount > currentRowCount) {
                console.log(`成功加载了${newRowCount - currentRowCount}行新数据`);
                return true;
            } else {
                console.log('没有加载到新数据');
                return false;
            }
            
        } catch (error) {
            console.error(`加载更多数据失败:`, error);
            return false;
        }
    }
    
    async navigateToNextPage(pageNum) {
        console.log(`尝试导航到第${pageNum + 1}页...`);
        
        try {
            // 查找下一页按钮 - 改进的分页逻辑
            const nextPageClicked = await this.page.evaluate((targetPage) => {
                // 查找所有可能的分页元素
                const allElements = document.querySelectorAll('*');
                const targetPageStr = targetPage.toString();
                
                for (let el of allElements) {
                    const text = el.textContent ? el.textContent.trim() : '';
                    
                    // 查找目标页码
                    if (text === targetPageStr) {
                        // 检查元素是否可点击
                        const style = window.getComputedStyle(el);
                        if (style.cursor === 'pointer' || el.tagName === 'BUTTON' || el.tagName === 'A' || el.onclick) {
                            console.log(`找到第${targetPage}页按钮:`, el.tagName, el.className);
                            el.click();
                            return true;
                        }
                    }
                }
                
                // 如果没找到数字按钮，尝试查找"下一页"按钮
                for (let el of allElements) {
                    const text = el.textContent ? el.textContent.trim() : '';
                    if (text.includes('下一页') || text.includes('下页') || text === '>') {
                        console.log('找到下一页按钮:', el.tagName, el.className);
                        el.click();
                        return true;
                    }
                }
                
                return false;
            }, pageNum + 1);
            
            if (nextPageClicked) {
                console.log('成功点击分页按钮，等待页面加载...');
                await this.page.waitForTimeout(4000);
                return true;
            } else {
                console.log('未找到分页按钮，尝试加载更多数据...');
                return await this.loadMoreData(pageNum);
            }
            
        } catch (error) {
            console.error(`导航到下一页失败:`, error);
            return false;
        }
    }

    async scrapeAllPages() {
        console.log(`开始抓取所有${this.totalPages}页数据...`);
        
        for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
            try {
                // 抓取当前页数据
                const pageData = await this.scrapePageData(pageNum);
                this.allData.push(pageData);
                
                // 如果不是最后一页，导航到下一页
                if (pageNum < this.totalPages) {
                    const success = await this.navigateToNextPage(pageNum);
                    if (!success) {
                        console.log(`无法导航到第${pageNum + 1}页，停止抓取`);
                        break;
                    }
                }
            } catch (error) {
                console.error(`处理第${pageNum}页时出错:`, error);
                this.allData.push({ page: pageNum, error: error.message, records: [] });
            }
        }
        
        console.log(`完成数据抓取，共抓取${this.allData.length}页数据`);
    }

    async saveData() {
        console.log('保存数据到文件...');
        
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `taiwan_pk10_data_${this.targetDate}_${timestamp}.json`;
            const filepath = path.join(__dirname, filename);
            
            const dataToSave = {
                scrapeTime: new Date().toISOString(),
                targetDate: this.targetDate,
                totalPages: this.totalPages,
                totalRecords: this.allData.reduce((sum, page) => sum + page.records.length, 0),
                data: this.allData
            };
            
            await fs.writeFile(filepath, JSON.stringify(dataToSave, null, 2), 'utf8');
            console.log(`数据已保存到: ${filepath}`);
            
            // 同时保存一份最新数据文件
            const latestFilepath = path.join(__dirname, 'taiwan_pk10_latest_scraped.json');
            await fs.writeFile(latestFilepath, JSON.stringify(dataToSave, null, 2), 'utf8');
            console.log(`最新数据已保存到: ${latestFilepath}`);
            
            return filepath;
        } catch (error) {
            console.error('保存数据失败:', error);
            throw error;
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            console.log('浏览器已关闭');
        }
    }

    async run() {
        try {
            console.log('开始自动化数据抓取...');
            
            console.log('步骤1: 初始化浏览器...');
            await this.init();
            console.log('步骤1完成: 浏览器初始化成功');
            
            console.log('步骤2: 导航到网站...');
            await this.navigateToSite();
            console.log('步骤2完成: 网站导航成功');
            
            console.log('步骤3: 选择台湾PK10...');
            await this.selectTaiwanPK10();
            console.log('步骤3完成: 台湾PK10选择成功');
            
            console.log('步骤4: 选择日期...');
            await this.selectDate();
            console.log('步骤4完成: 日期选择成功');
            
            console.log('步骤5: 抓取所有页面数据...');
            await this.scrapeAllPages();
            console.log('步骤5完成: 数据抓取成功');
            
            console.log('步骤6: 保存数据...');
            const savedFile = await this.saveData();
            console.log('步骤6完成: 数据保存成功');
            
            console.log('数据抓取完成!');
            console.log(`抓取的数据已保存到: ${savedFile}`);
            
            return {
                success: true,
                dataFile: savedFile,
                totalPages: this.allData.length,
                totalRecords: this.allData.reduce((sum, page) => sum + page.records.length, 0)
            };
        } catch (error) {
            console.error('数据抓取过程中出错:', error);
            console.error('错误堆栈:', error.stack);
            return {
                success: false,
                error: error.message
            };
        } finally {
            console.log('清理资源...');
            await this.cleanup();
            console.log('资源清理完成');
        }
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    const scraper = new TaiwanPK10Scraper();
    scraper.run().then(result => {
        console.log('抓取结果:', result);
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('脚本执行失败:', error);
        process.exit(1);
    });
}

export default TaiwanPK10Scraper;