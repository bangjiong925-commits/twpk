#!/usr/bin/env node

/**
 * MongoDB Atlas 配置助手
 * 帮助用户快速配置MongoDB Atlas云数据库连接
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🌟 MongoDB Atlas 配置助手\n');
console.log('此工具将帮助您配置MongoDB Atlas云数据库连接\n');

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function validateConnectionString(connectionString) {
  // 基本验证MongoDB Atlas连接字符串格式
  const atlasPattern = /^mongodb\+srv:\/\/[^:]+:[^@]+@[^/]+\/[^?]+\?.*$/;
  return atlasPattern.test(connectionString);
}

function updateEnvFile(connectionString) {
  const envPath = path.join(__dirname, '.env');
  const envContent = `# MongoDB Atlas 云数据库配置\n# 自动生成于: ${new Date().toLocaleString()}\n\nDATABASE_URL=${connectionString}\n\n# 本地MongoDB连接已禁用\n# DATABASE_URL=mongodb://localhost:27017/twpk\n`;
  
  try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ .env 文件已更新');
    return true;
  } catch (error) {
    console.error('❌ 更新 .env 文件失败:', error.message);
    return false;
  }
}

function showInstructions() {
  console.log('\n📋 MongoDB Atlas 设置步骤:\n');
  console.log('1. 访问: https://www.mongodb.com/cloud/atlas');
  console.log('2. 注册账户并创建免费集群 (M0 Sandbox)');
  console.log('3. 创建数据库用户 (Database Access)');
  console.log('4. 配置网络访问 (Network Access) - 允许所有IP (0.0.0.0/0)');
  console.log('5. 获取连接字符串 (Connect > Connect your application)');
  console.log('\n连接字符串格式示例:');
  console.log('mongodb+srv://用户名:密码@cluster0.xxxxx.mongodb.net/数据库名?retryWrites=true&w=majority\n');
}

async function main() {
  try {
    showInstructions();
    
    const hasAtlas = await askQuestion('您是否已经设置了MongoDB Atlas集群? (y/n): ');
    
    if (hasAtlas.toLowerCase() !== 'y' && hasAtlas.toLowerCase() !== 'yes') {
      console.log('\n请先按照上述步骤设置MongoDB Atlas，然后重新运行此脚本。');
      console.log('\n💡 提示: 设置完成后，运行 node setup-mongodb-atlas.js');
      rl.close();
      return;
    }
    
    console.log('\n请输入您的MongoDB Atlas连接字符串:');
    const connectionString = await askQuestion('连接字符串: ');
    
    if (!connectionString) {
      console.log('❌ 连接字符串不能为空');
      rl.close();
      return;
    }
    
    if (!validateConnectionString(connectionString)) {
      console.log('❌ 连接字符串格式不正确');
      console.log('请确保使用 mongodb+srv:// 格式，并包含用户名、密码和集群地址');
      rl.close();
      return;
    }
    
    console.log('\n🔍 验证连接字符串格式... ✅');
    
    if (updateEnvFile(connectionString)) {
      console.log('\n🎉 MongoDB Atlas 配置完成!');
      console.log('\n下一步:');
      console.log('1. 运行 npm start 启动应用');
      console.log('2. 检查终端输出确认数据库连接成功');
      console.log('\n💡 如果连接失败，请检查:');
      console.log('- 用户名和密码是否正确');
      console.log('- 网络访问是否已配置 (0.0.0.0/0)');
      console.log('- 集群是否已启动');
    }
    
  } catch (error) {
    console.error('❌ 配置过程中出现错误:', error.message);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { updateEnvFile, validateConnectionString };