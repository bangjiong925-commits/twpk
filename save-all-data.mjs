// 保存所有抓取数据到数据库
import fs from 'fs/promises';
import mongoose from 'mongoose';

// 数据模型
const taiwanPK10DataSchema = new mongoose.Schema({
  period: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  drawNumbers: {
    type: [Number],
    required: true
  },
  drawDate: {
    type: Date,
    required: true
  },
  drawTime: {
    type: String,
    required: true
  },
  dataSource: {
    type: String,
    default: 'manual'
  }
}, {
  timestamps: true,
  collection: 'taiwanPK10Data'
});

const TaiwanPK10Data = mongoose.model('TaiwanPK10Data', taiwanPK10DataSchema);

async function saveAllData() {
  try {
    console.log('开始保存所有抓取数据到数据库...');
    
    // 连接数据库
    console.log('连接数据库...');
    await mongoose.connect('mongodb://localhost:27017/twpk10');
    console.log('数据库连接成功');
    
    // 读取抓取的数据
    console.log('读取抓取数据...');
    const data = await fs.readFile('./taiwan_pk10_latest_scraped.json', 'utf8');
    const scrapedData = JSON.parse(data);
    console.log(`加载了 ${scrapedData.totalRecords} 条记录`);
    
    let savedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    // 处理所有页面的数据
    for (const pageData of scrapedData.data) {
      console.log(`\n处理第 ${pageData.page} 页数据 (${pageData.records.length} 条记录)...`);
      
      for (const record of pageData.records) {
        try {
          const period = record.column_1;
          const numbersStr = record.formatted.split(' ')[1];
          const drawNumbers = numbersStr.split(',').map(num => parseInt(num.trim()));
          
          // 解析日期
          const year = '2025';
          const month = '08';
          const day = '24';
          const [hour, minute] = record.column_0.split(':');
          const drawDate = new Date(year, month - 1, day, hour, minute);
          
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
            dataSource: 'manual'
          });
          
          await newRecord.save();
          savedCount++;
          
          // 每保存50条记录显示进度
          if (savedCount % 50 === 0) {
            console.log(`已保存 ${savedCount} 条记录...`);
          }
        } catch (error) {
          console.error(`保存记录失败 (期号: ${record.column_1}):`, error.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n保存完成!');
    console.log(`总记录数: ${scrapedData.totalRecords}`);
    console.log(`新保存: ${savedCount}`);
    console.log(`重复跳过: ${duplicateCount}`);
    console.log(`错误: ${errorCount}`);
    
    // 验证数据库中的记录数
    const totalInDB = await TaiwanPK10Data.countDocuments();
    console.log(`数据库中总记录数: ${totalInDB}`);
    
  } catch (error) {
    console.error('保存失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

saveAllData();