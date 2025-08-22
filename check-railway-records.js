// 检查Railway部署的密钥记录
const fetch = require('node-fetch');

async function checkRailwayRecords() {
    try {
        console.log('🔍 检查Railway部署的密钥记录...');
        
        const response = await fetch('https://twpk-production.up.railway.app/api/key-records', {
            method: 'GET',
            headers: {
                'User-Agent': 'TWPK-KeyValidator/1.0'
            }
        });
        
        if (response.ok) {
            const records = await response.json();
            console.log('✅ Railway数据库连接成功');
            console.log(`📊 总记录数: ${records.length}`);
            
            if (records.length > 0) {
                console.log('\n📋 最近的记录:');
                records.slice(-5).forEach((record, index) => {
                    const usedTime = new Date(record.usedAt).toLocaleString('zh-CN');
                    console.log(`${index + 1}. KeyID: ${record.keyId}`);
                    console.log(`   使用时间: ${usedTime}`);
                    console.log(`   设备信息: ${record.deviceInfo.substring(0, 50)}...`);
                    console.log('---');
                });
            } else {
                console.log('❌ Railway数据库中没有找到任何密钥记录');
                console.log('可能的原因:');
                console.log('1. 手机验证时网络连接失败');
                console.log('2. API请求被阻止');
                console.log('3. 数据库写入失败');
            }
        } else {
            console.error(`❌ Railway API请求失败: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ 检查Railway记录时出错:', error.message);
    }
}

async function checkLocalRecords() {
    try {
        console.log('\n🔍 检查本地数据库记录...');
        
        const response = await fetch('http://localhost:3000/api/key-records', {
            method: 'GET',
            headers: {
                'User-Agent': 'TWPK-KeyValidator/1.0'
            }
        });
        
        if (response.ok) {
            const records = await response.json();
            console.log('✅ 本地数据库连接成功');
            console.log(`📊 总记录数: ${records.length}`);
            
            if (records.length > 0) {
                console.log('\n📋 最近的记录:');
                records.slice(-5).forEach((record, index) => {
                    const usedTime = new Date(record.usedAt).toLocaleString('zh-CN');
                    console.log(`${index + 1}. KeyID: ${record.keyId}`);
                    console.log(`   使用时间: ${usedTime}`);
                    console.log(`   设备信息: ${record.deviceInfo.substring(0, 50)}...`);
                    console.log('---');
                });
            } else {
                console.log('❌ 本地数据库中没有找到任何密钥记录');
            }
        } else {
            console.error(`❌ 本地API请求失败: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ 检查本地记录时出错:', error.message);
    }
}

async function main() {
    console.log('🚀 开始检查密钥记录...');
    console.log('=' .repeat(50));
    
    await checkRailwayRecords();
    await checkLocalRecords();
    
    console.log('\n' + '='.repeat(50));
    console.log('💡 说明:');
    console.log('- Railway部署和本地服务使用不同的数据库');
    console.log('- 手机在Railway网站验证的记录只会保存到Railway数据库');
    console.log('- 本地密钥管理页面只能看到本地数据库的记录');
    console.log('- 这是正常的架构设计，两个环境是独立的');
}

main().catch(console.error);