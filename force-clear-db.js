const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// 密钥记录模式
const keyRecordSchema = new mongoose.Schema({
  keyId: { type: String, required: true, unique: true },
  usedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  deviceId: String,
  deviceInfo: String,
  userAgent: String,
  ipAddress: String,
  nonce: String
});

const KeyRecord = mongoose.model('KeyRecord', keyRecordSchema);

async function forceClearDatabase() {
  let connection = null;
  
  try {
    console.log('🔄 开始强制清理数据库...');
    
    // 尝试多种连接方式
    const connectionStrings = [
      process.env.DATABASE_URL,
      process.env.MONGODB_URI,
      'mongodb://localhost:27017/twpk'
    ].filter(Boolean);
    
    console.log('📋 可用的连接字符串:', connectionStrings.length);
    
    for (let i = 0; i < connectionStrings.length; i++) {
      const connStr = connectionStrings[i];
      console.log(`\n🔗 尝试连接 ${i + 1}/${connectionStrings.length}: ${connStr.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local MongoDB'}`);
      
      try {
        connection = await mongoose.connect(connStr, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
          socketTimeoutMS: 10000,
        });
        
        console.log('✅ 数据库连接成功!');
        console.log('📊 数据库状态:', mongoose.connection.readyState);
        console.log('🏷️  数据库名称:', mongoose.connection.db?.databaseName || 'unknown');
        break;
        
      } catch (error) {
        console.log(`❌ 连接失败: ${error.message}`);
        if (i === connectionStrings.length - 1) {
          throw new Error('所有连接尝试都失败了');
        }
        continue;
      }
    }
    
    if (!connection) {
      throw new Error('无法建立数据库连接');
    }
    
    // 检查现有记录
    console.log('\n📋 检查现有密钥记录...');
    const existingCount = await KeyRecord.countDocuments();
    console.log(`📊 找到 ${existingCount} 条密钥记录`);
    
    if (existingCount > 0) {
      // 列出所有记录的详细信息
      const records = await KeyRecord.find({}, 'keyId usedAt expiresAt deviceId').lean();
      console.log('\n📝 现有记录详情:');
      records.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.keyId}`);
        console.log(`     使用时间: ${record.usedAt}`);
        console.log(`     过期时间: ${record.expiresAt}`);
        console.log(`     设备ID: ${record.deviceId || 'N/A'}`);
        console.log('');
      });
      
      // 强制删除所有记录
      console.log('🗑️  开始删除所有密钥记录...');
      const deleteResult = await KeyRecord.deleteMany({});
      console.log(`✅ 成功删除 ${deleteResult.deletedCount} 条记录`);
      
      // 验证删除结果
      const remainingCount = await KeyRecord.countDocuments();
      console.log(`🔍 验证: 剩余记录数量 = ${remainingCount}`);
      
      if (remainingCount === 0) {
        console.log('🎉 数据库清理完成！所有密钥记录已删除。');
      } else {
        console.log(`⚠️  警告: 仍有 ${remainingCount} 条记录未删除`);
      }
    } else {
      console.log('✅ 数据库中没有密钥记录，无需清理。');
    }
    
    // 重置集合索引（可选）
    console.log('\n🔄 重置集合索引...');
    try {
      await KeyRecord.collection.dropIndexes();
      await KeyRecord.createIndexes();
      console.log('✅ 索引重置完成');
    } catch (indexError) {
      console.log('⚠️  索引重置失败:', indexError.message);
    }
    
  } catch (error) {
    console.error('❌ 数据库清理失败:', error.message);
    console.error('📋 错误详情:', {
      name: error.name,
      code: error.code,
      codeName: error.codeName
    });
    process.exit(1);
  } finally {
    if (connection) {
      console.log('\n🔌 关闭数据库连接...');
      await mongoose.connection.close();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 运行清理脚本
forceClearDatabase().then(() => {
  console.log('\n🏁 脚本执行完成');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 脚本执行失败:', error);
  process.exit(1);
});