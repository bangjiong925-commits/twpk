// 将抓取的数据保存到数据库
import fs from 'fs/promises';
import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';

class DataSaver {
    constructor() {
        this.mongoUri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10';
    }

    async connectDatabase() {
        try {
            await mongoose.connect(this.mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('数据库连接成功');
        } catch (error) {
            console.error('数据库连接失败:', error);
            throw error;
        }
    }

    async loadScrapedData() {
        try {
            const data = await fs.readFile('./taiwan_pk10_latest_scraped.json', 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('读取抓取数据失败:', error);
            throw error;
        }
    }

    parseDrawNumbers(numbersStr) {
        // 解析开奖号码字符串，例如 "4,9,7,2,10,8,3,1,6,5"
        return numbersStr.split(',').map(num => parseInt(num.trim()));
    }

    formatPeriod(period) {
        // 确保期号格式正确，例如 "114047908" -> "20250824908"
        if (period.length === 9) {
            // 假设格式是 YYMMDDXXX，转换为 YYYYMMDDXXX
            const year = '20' + period.substring(0, 2);
            const rest = period.substring(2);
            return year + rest;
        }
        return period;
    }

    parseDrawDate(period, drawTime) {
        // 从期号解析日期
        const year = period.substring(0, 4);
        const month = period.substring(4, 6);
        const day = period.substring(6, 8);
        
        // 解析时间
        const [hour, minute] = drawTime.split(':');
        
        return new Date(year, month - 1, day, hour, minute);
    }

    async saveToDatabase(scrapedData) {
        let savedCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        console.log(`开始保存 ${scrapedData.totalRecords} 条记录到数据库...`);

        for (const pageData of scrapedData.data) {
            for (const record of pageData.records) {
                try {
                    const period = this.formatPeriod(record.column_1);
                    const drawNumbers = this.parseDrawNumbers(record.formatted.split(' ')[1]);
                    const drawDate = this.parseDrawDate(period, record.column_0);

                    // 检查是否已存在
                    const existing = await TaiwanPK10Data.findOne({ period });
                    if (existing) {
                        duplicateCount++;
                        continue;
                    }

                    // 创建新记录
                    const newRecord = new TaiwanPK10Data({
                        period,
                        drawNumbers,
                        drawDate,
                        drawTime: record.column_0,
                        dataSource: 'manual',
                        scrapedAt: new Date(scrapedData.scrapeTime)
                    });

                    await newRecord.save();
                    savedCount++;
                    
                    if (savedCount % 50 === 0) {
                        console.log(`已保存 ${savedCount} 条记录...`);
                    }
                } catch (error) {
                    console.error(`保存记录失败 (期号: ${record.column_1}):`, error.message);
                    errorCount++;
                }
            }
        }

        return {
            total: scrapedData.totalRecords,
            saved: savedCount,
            duplicates: duplicateCount,
            errors: errorCount
        };
    }

    async run() {
        try {
            console.log('开始将抓取数据保存到数据库...');
            
            // 连接数据库
            await this.connectDatabase();
            
            // 加载抓取的数据
            const scrapedData = await this.loadScrapedData();
            console.log(`加载了 ${scrapedData.totalRecords} 条抓取记录`);
            
            // 保存到数据库
            const result = await this.saveToDatabase(scrapedData);
            
            console.log('\n保存结果:');
            console.log(`总记录数: ${result.total}`);
            console.log(`新保存: ${result.saved}`);
            console.log(`重复跳过: ${result.duplicates}`);
            console.log(`错误: ${result.errors}`);
            
            return result;
        } catch (error) {
            console.error('保存过程出错:', error);
            throw error;
        } finally {
            await mongoose.disconnect();
            console.log('数据库连接已关闭');
        }
    }
}

// 检查是否为直接运行
if (import.meta.url === `file://${process.argv[1]}`) {
    const saver = new DataSaver();
    saver.run().then(result => {
        console.log('数据保存完成!');
        process.exit(0);
    }).catch(error => {
        console.error('数据保存失败:', error);
        process.exit(1);
    });
}

export default DataSaver;