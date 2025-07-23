const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 开始部署混淆版本...');

try {
    // 1. 生成混淆版本
    console.log('📦 正在混淆代码...');
    execSync('node build-obfuscated.js', { stdio: 'inherit' });
    
    // 2. 备份原文件
    console.log('💾 备份原文件...');
    if (fs.existsSync('TWPK-original.html')) {
        fs.unlinkSync('TWPK-original.html');
    }
    fs.copyFileSync('TWPK.html', 'TWPK-original.html');
    
    // 3. 替换为混淆版本
    console.log('🔄 替换为混淆版本...');
    fs.copyFileSync('TWPK-obfuscated.html', 'TWPK.html');
    
    // 4. 更新部署触发文件
    console.log('📝 更新部署信息...');
    const deployMessage = `Deploy trigger: ${new Date().toISOString().split('T')[0]} Deploy obfuscated version for algorithm protection`;
    fs.writeFileSync('trigger-deploy.txt', deployMessage);
    
    // 5. 提交到Git
    console.log('📤 提交到Git...');
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Deploy obfuscated version for algorithm protection"', { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    
    console.log('✅ 混淆版本部署完成！');
    console.log('🔒 算法逻辑已被保护');
    console.log('📁 原文件已备份为: TWPK-original.html');
    console.log('🌐 网站将在几分钟内更新');
    
} catch (error) {
    console.error('❌ 部署失败:', error.message);
    process.exit(1);
}