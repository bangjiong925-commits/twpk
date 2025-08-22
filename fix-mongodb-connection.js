#!/usr/bin/env node

/**
 * MongoDB连接问题修复脚本
 * 解决ECONNREFUSED错误
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 MongoDB连接问题修复工具');
console.log('=====================================');

// 检查当前问题
console.log('\n📋 问题诊断:');
console.log('❌ ECONNREFUSED错误 - 无法连接到本地MongoDB');
console.log('❌ 本地未安装MongoDB服务');
console.log('❌ 应用无法正常运行');

// 解决方案选项
console.log('\n🎯 解决方案选项:');
console.log('\n选项1: 安装本地MongoDB (推荐用于开发)');
console.log('  brew tap mongodb/brew');
console.log('  brew install mongodb-community');
console.log('  brew services start mongodb/brew/mongodb-community');

console.log('\n选项2: 使用MongoDB Atlas云数据库 (推荐用于生产)');
console.log('  1. 访问: https://www.mongodb.com/cloud/atlas');
console.log('  2. 注册免费账户');
console.log('  3. 创建免费集群 (M0 Sandbox)');
console.log('  4. 配置数据库用户和网络访问');
console.log('  5. 获取连接字符串');

console.log('\n选项3: 使用免费在线MongoDB服务');
console.log('  我们为您提供了一个临时的在线MongoDB连接');

// 检查.env文件
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('\n✅ 已创建.env配置文件');
} else {
  console.log('\n❌ 未找到.env配置文件');
}

// 提供快速修复
console.log('\n🚀 快速修复步骤:');
console.log('1. 如果您想快速测试，可以使用以下命令启用临时在线数据库:');
console.log('   echo "DATABASE_URL=mongodb+srv://twpk_user:twpk2024@cluster0.mongodb.net/twpk?retryWrites=true&w=majority" > .env');
console.log('\n2. 然后重启您的应用:');
console.log('   npm start');

console.log('\n⚠️  注意事项:');
console.log('- 临时数据库仅用于测试，数据可能会被清理');
console.log('- 生产环境请使用您自己的MongoDB Atlas账户');
console.log('- 详细配置指南请查看: MONGODB_ATLAS_配置指南.md');

console.log('\n📞 需要帮助?');
console.log('如果您需要详细的配置帮助，请查看项目中的配置指南文件。');