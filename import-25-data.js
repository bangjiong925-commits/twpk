import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';
import fs from 'fs';

async function import25Data() {
  try {
    const mongoURI = process.env.DATABASE_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10';
    await mongoose.connect(mongoURI);
    console.log('MongoDB连接成功');
    
    const jsonData = JSON.parse(fs.readFileSync('./taiwan_pk10_data_25_2025-08-25T06-38-20-237Z.json', 'utf8'));
    console.log('读取到', jsonData.totalRecords, '条25号数据');
    
    let importedCount = 0;
    
    for (const pageData of jsonData.data) {
      for (const record of pageData.records) {
        const period = record.column_1;
        const existing = await TaiwanPK10Data.findOne({ period });
        
        if (!existing) {
          const drawNumbers = record.column_2.split('').map(Number);
          const [hours, minutes] = record.column_0.split(':');
          const drawDate = new Date('2025-08-25T' + hours + ':' + minutes + ':00.000Z');
          const drawTime = record.column_0;
          
          const newRecord = new TaiwanPK10Data({
            period,
            drawNumbers,
            drawDate,
            drawTime
          });
          
          await newRecord.save();
          importedCount++;
        }
      }
    }
    
    console.log('成功导入', importedCount, '条25号新记录');
    
    const totalCount = await TaiwanPK10Data.countDocuments();
    console.log('数据库总记录数:', totalCount);
    
    await mongoose.disconnect();
  } catch(e) {
    console.error('错误:', e.message);
  }
}

import25Data();