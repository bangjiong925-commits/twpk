// 测试数据保存脚本
import DataSaver from './save-to-database.mjs';

async function testSave() {
  console.log('开始测试数据保存...');
  
  const saver = new DataSaver();
  
  try {
    const result = await saver.run();
    console.log('保存结果:', result);
  } catch (error) {
    console.error('保存失败:', error);
  }
}

testSave();