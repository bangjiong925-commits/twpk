// 测试数据保存到数据库
import fs from 'fs/promises';
import mongoose from 'mongoose';

// 简单的数据模型
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

async function testSave() {
  try {
    console.log('开始测试数据保存...');
    
    // 连接数据库
    console.log('连接数据库...');
    await mongoose.connect('mongodb://localhost:27017/twpk10', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('数据库连接成功');
    
    // 读取抓取的数据
    console.log('读取抓取数据...');
    const data = await fs.readFile('./taiwan_pk10_latest_scraped.json', 'utf8');
    const scrapedData = JSON.parse(data);
    console.log(`加载了 ${scrapedData.totalRecords} 条记录`);
    
    let savedCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    
    // 处理前5条记录作为测试
    const testRecords = scrapedData.data[0].records.slice(0, 5);
    console.log(`测试保存前 ${testRecords.length} 条记录...`);
    
    for (const record of testRecords) {
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
        
        console.log(`处理期号: ${period}, 号码: ${drawNumbers.join(',')}, 时间: ${record.column_0}`);
        
        // 检查是否已存在
        const existing = await TaiwanPK10Data.findOne({ period });
        if (existing) {
          console.log(`期号 ${period} 已存在，跳过`);
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
        console.log(`成功保存期号: ${period}`);
        savedCount++;
      } catch (error) {
        console.error(`保存记录失败 (期号: ${record.column_1}):`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n测试结果:');
    console.log(`测试记录数: ${testRecords.length}`);
    console.log(`新保存: ${savedCount}`);
    console.log(`重复跳过: ${duplicateCount}`);
    console.log(`错误: ${errorCount}`);
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

testSave();