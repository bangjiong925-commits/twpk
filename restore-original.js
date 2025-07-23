const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔄 开始恢复原始版本...');

try {
    // 检查备份文件是否存在
    if (!fs.existsSync('TWPK-original.html')) {
        console.error('❌ 未找到备份文件 TWPK-original.html');
        console.log('💡 请确保之前已运行过混淆部署脚本');
        process.exit(1);
    }
    
    // 1. 恢复原始文件
    console.log('📦 恢复原始文件...');
    fs.copyFileSync('TWPK-original.html', 'TWPK.html');
    
    // 2. 更新部署触发文件
    console.log('📝 更新部署信息...');
    const deployMessage = `Deploy trigger: ${new Date().toISOString().split('T')[0]} Restore original version`;
    fs.writeFileSync('trigger-deploy.txt', deployMessage);
    
    // 3. 提交到Git
    console.log('📤 提交到Git...');
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Restore original version"', { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    
    console.log('✅ 原始版本恢复完成！');
    console.log('🌐 网站将在几分钟内更新为原始版本');
    
} catch (error) {
    console.error('❌ 恢复失败:', error.message);
    process.exit(1);
}