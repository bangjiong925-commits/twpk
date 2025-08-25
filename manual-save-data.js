// 手动保存抓取数据到数据库
import fs from 'fs/promises';
import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';
import dotenv from 'dotenv';

dotenv.config();

async function saveScrapedDataToDatabase() {
    try {
        console.log('开始保存抓取数据到数据库...');
        
        // 连接数据库
        const mongoUri = process.env.DATABASE_URL || 'mongodb://localhost:27017/twpk10';
        console.log('连接数据库:', mongoUri.replace(/\/\/.*@/, '//***:***@'));
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('数据库连接成功');
        
        // 读取抓取的数据
        console.log('读取抓取数据文件...');
        const data = await fs.readFile('./taiwan_pk10_latest_scraped.json', 'utf8');
        const scrapedData = JSON.parse(data);
        console.log(`加载了 ${scrapedData.totalRecords} 条抓取记录`);
        
        let savedCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;
        
        console.log('开始处理数据...');
        
        // 处理所有页面的数据
        for (const pageData of scrapedData.data) {
            console.log(`处理第 ${pageData.page} 页数据 (${pageData.records.length} 条记录)...`);
            
            for (const record of pageData.records) {
                try {
                    const period = record.column_1;
                    const numbersStr = record.formatted.split(' ')[1];
                    const drawNumbers = numbersStr.split(',').map(num => parseInt(num.trim()));
                    
                    // 解析日期和时间
                    const drawTime = record.column_0;
                    const today = new Date();
                    const year = today.getFullYear();
                    const month = today.getMonth();
                    const day = today.getDate();
                    
                    const [hour, minute] = drawTime.split(':');
                    const drawDate = new Date(year, month, day, parseInt(hour), parseInt(minute));
                    
                    console.log(`处理期号: ${period}, 号码: ${drawNumbers.join(',')}, 时间: ${drawTime}`);
                    
                    // 检查是否已存在
                    const existing = await TaiwanPK10Data.findOne({ period });
                    if (existing) {
                        duplicateCount++;
                        console.log(`期号 ${period} 已存在，跳过`);
                        continue;
                    }
                    
                    // 创建新记录
                    const newRecord = new TaiwanPK10Data({
                        period,
                        drawNumbers,
                        drawDate,
                        drawTime,
                        dataSource: 'manual',
                        scrapedAt: new Date(scrapedData.scrapeTime)
                    });
                    
                    await newRecord.save();
                    savedCount++;
                    console.log(`保存成功: 期号 ${period}`);
                    
                } catch (error) {
                    console.error(`保存记录失败 (期号: ${record.column_1}):`, error.message);
                    errorCount++;
                }
            }
        }
        
        console.log('\n=== 保存结果 ===');
        console.log(`总记录数: ${scrapedData.totalRecords}`);
        console.log(`新保存: ${savedCount}`);
        console.log(`重复跳过: ${duplicateCount}`);
        console.log(`错误: ${errorCount}`);
        
        return {
            total: scrapedData.totalRecords,
            saved: savedCount,
            duplicates: duplicateCount,
            errors: errorCount
        };
        
    } catch (error) {
        console.error('保存过程出错:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('数据库连接已关闭');
    }
}

// 执行保存
saveScrapedDataToDatabase()
    .then(result => {
        console.log('数据保存完成!');
        process.exit(0);
    })
    .catch(error => {
        console.error('数据保存失败:', error);
        process.exit(1);
    });