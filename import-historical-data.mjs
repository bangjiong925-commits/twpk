import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 连接MongoDB
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taiwan_pk10';
        await mongoose.connect(mongoURI);
        console.log('MongoDB连接成功');
    } catch (error) {
        console.error('MongoDB连接失败:', error);
        process.exit(1);
    }
};

// 解析txt文件数据
const parseDataFile = (filePath, date) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const records = [];
        
        for (const line of lines) {
            const parts = line.trim().split(' ');
            if (parts.length >= 2) {
                const period = parts[0];
                const numbersStr = parts.slice(1).join(' ');
                const numbers = numbersStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                
                if (numbers.length === 10) {
                    records.push({
                        period: period,
                        drawNumbers: numbers,
                        drawDate: new Date(`${date}T00:00:00.000Z`),
                        drawTime: '00:00:00',
                        dataSource: 'manual'
                    });
                }
            }
        }
        
        return records;
    } catch (error) {
        console.error(`解析文件 ${filePath} 失败:`, error);
        return [];
    }
};

// 导入历史数据
const importHistoricalData = async () => {
    try {
        await connectDB();
        
        // 历史数据文件列表
        const dataFiles = [
            { file: '20250822.txt', date: '2025-08-22' },
            { file: '20250823.txt', date: '2025-08-23' },
            { file: '20250824.txt', date: '2025-08-24' }
        ];
        
        let totalImported = 0;
        
        for (const { file, date } of dataFiles) {
            const filePath = path.join(__dirname, file);
            
            if (!fs.existsSync(filePath)) {
                console.log(`文件 ${file} 不存在，跳过`);
                continue;
            }
            
            console.log(`正在处理文件: ${file}`);
            const records = parseDataFile(filePath, date);
            
            if (records.length === 0) {
                console.log(`文件 ${file} 没有有效数据`);
                continue;
            }
            
            // 批量插入数据，使用upsert避免重复
            let imported = 0;
            for (const record of records) {
                try {
                    const existingRecord = await TaiwanPK10Data.findOne({ period: record.period });
                    if (!existingRecord) {
                        await TaiwanPK10Data.create(record);
                        imported++;
                    } else {
                        console.log(`期号 ${record.period} 已存在，跳过`);
                    }
                } catch (error) {
                    console.error(`插入记录失败 (期号: ${record.period}):`, error.message);
                }
            }
            
            console.log(`文件 ${file} 导入完成: ${imported}/${records.length} 条记录`);
            totalImported += imported;
        }
        
        console.log(`\n历史数据导入完成，总计导入 ${totalImported} 条记录`);
        
        // 显示数据库统计信息
        const totalCount = await TaiwanPK10Data.countDocuments();
        console.log(`数据库中总计 ${totalCount} 条记录`);
        
        // 显示最新的几条记录
        const latestRecords = await TaiwanPK10Data.find()
            .sort({ period: -1 })
            .limit(5)
            .select('period drawNumbers drawDate');
        
        console.log('\n最新的5条记录:');
        latestRecords.forEach(record => {
            console.log(`期号: ${record.period}, 号码: ${record.drawNumbers.join(',')}, 日期: ${record.drawDate}`);
        });
        
    } catch (error) {
        console.error('导入历史数据失败:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n数据库连接已关闭');
    }
};

// 直接运行导入函数
console.log('开始导入历史数据...');
importHistoricalData().catch(error => {
    console.error('导入失败:', error);
    process.exit(1);
});

export { importHistoricalData, parseDataFile };