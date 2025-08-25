import mongoose from 'mongoose';
import TaiwanPK10Data from './models/TaiwanPK10Data.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearTaiwanPK10Data() {
  try {
    console.log('🔄 开始清理台湾宾果数据...');
    
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twpk10');
    console.log('✅ 数据库连接成功');
    
    // 检查现有记录数量
    const existingCount = await TaiwanPK10Data.countDocuments();
    console.log(`📊 找到 ${existingCount} 条台湾宾果记录`);
    
    if (existingCount > 0) {
      // 删除所有记录
      console.log('🗑️  开始删除所有台湾宾果记录...');
      const deleteResult = await TaiwanPK10Data.deleteMany({});
      console.log(`✅ 成功删除 ${deleteResult.deletedCount} 条记录`);
      
      // 验证删除结果
      const remainingCount = await TaiwanPK10Data.countDocuments();
      console.log(`🔍 验证: 剩余记录数量 = ${remainingCount}`);
      
      if (remainingCount === 0) {
        console.log('🎉 台湾宾果数据清理完成！');
      } else {
        console.log(`⚠️  警告: 仍有 ${remainingCount} 条记录未删除`);
      }
    } else {
      console.log('✅ 数据库中没有台湾宾果记录，无需清理。');
    }
    
  } catch (error) {
    console.error('❌ 数据清理失败:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

// 运行清理脚本
clearTaiwanPK10Data().then(() => {
  console.log('\n🏁 脚本执行完成');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 脚本执行失败:', error);
  process.exit(1);
});