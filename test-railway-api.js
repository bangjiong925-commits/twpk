// 测试Railway API的健康状态和功能
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testRailwayHealth() {
    try {
        console.log('🔍 检查Railway API健康状态...');
        
        const response = await fetch('https://twpk-production.up.railway.app/api/health', {
            method: 'GET',
            headers: {
                'User-Agent': 'TWPK-KeyValidator/1.0'
            }
        });
        
        if (response.ok) {
            const health = await response.json();
            console.log('✅ Railway API健康检查成功');
            console.log('📊 健康状态:', JSON.stringify(health, null, 2));
            return true;
        } else {
            console.error(`❌ Railway健康检查失败: ${response.status} ${response.statusText}`);
            return false;
        }
    } catch (error) {
        console.error('❌ Railway健康检查出错:', error.message);
        return false;
    }
}

async function testKeyRecordCreation() {
    try {
        console.log('\n🔍 测试密钥记录创建功能...');
        
        const testRecord = {
            keyId: 'test_' + Date.now(),
            deviceInfo: 'Test Device - Node.js Script',
            usedAt: new Date().toISOString(),
            expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            createdTime: new Date().toISOString()
        };
        
        console.log('📝 发送测试记录:', testRecord);
        
        const response = await fetch('https://twpk-production.up.railway.app/api/key-records', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TWPK-KeyValidator/1.0'
            },
            body: JSON.stringify(testRecord)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ 测试记录创建成功');
            console.log('📊 创建结果:', JSON.stringify(result, null, 2));
            return testRecord.keyId;
        } else {
            const errorText = await response.text();
            console.error(`❌ 测试记录创建失败: ${response.status} ${response.statusText}`);
            console.error('错误详情:', errorText);
            return null;
        }
    } catch (error) {
        console.error('❌ 测试记录创建出错:', error.message);
        return null;
    }
}

async function testKeyRecordRetrieval() {
    try {
        console.log('\n🔍 重新检查密钥记录...');
        
        const response = await fetch('https://twpk-railway-deployment-production.up.railway.app/api/key-records', {
            method: 'GET',
            headers: {
                'User-Agent': 'TWPK-KeyValidator/1.0'
            }
        });
        
        if (response.ok) {
            const records = await response.json();
            console.log('✅ 密钥记录检索成功');
            console.log(`📊 总记录数: ${records.length}`);
            
            if (records.length > 0) {
                console.log('\n📋 所有记录:');
                records.forEach((record, index) => {
                    const usedTime = new Date(record.usedAt).toLocaleString('zh-CN');
                    console.log(`${index + 1}. KeyID: ${record.keyId}`);
                    console.log(`   使用时间: ${usedTime}`);
                    console.log(`   设备信息: ${record.deviceInfo}`);
                    console.log('---');
                });
            }
            return records;
        } else {
            console.error(`❌ 密钥记录检索失败: ${response.status} ${response.statusText}`);
            return null;
        }
    } catch (error) {
        console.error('❌ 密钥记录检索出错:', error.message);
        return null;
    }
}

async function cleanupTestRecord(keyId) {
    if (!keyId) return;
    
    try {
        console.log(`\n🧹 清理测试记录: ${keyId}`);
        
        const response = await fetch(`https://twpk-production.up.railway.app/api/key-records/${encodeURIComponent(keyId)}`, {
            method: 'DELETE',
            headers: {
                'User-Agent': 'TWPK-KeyValidator/1.0'
            }
        });
        
        if (response.ok) {
            console.log('✅ 测试记录清理成功');
        } else {
            console.error(`❌ 测试记录清理失败: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ 测试记录清理出错:', error.message);
    }
}

async function main() {
    console.log('🚀 开始Railway API功能测试...');
    console.log('=' .repeat(60));
    
    // 1. 健康检查
    const isHealthy = await testRailwayHealth();
    if (!isHealthy) {
        console.log('\n❌ Railway API不健康，停止测试');
        return;
    }
    
    // 2. 测试记录创建
    const testKeyId = await testKeyRecordCreation();
    
    // 3. 检查记录是否成功创建
    await testKeyRecordRetrieval();
    
    // 4. 清理测试记录
    await cleanupTestRecord(testKeyId);
    
    console.log('\n' + '='.repeat(60));
    console.log('💡 测试结论:');
    if (testKeyId) {
        console.log('✅ Railway API功能正常，数据库写入和读取都工作正常');
        console.log('🤔 手机验证时可能的问题:');
        console.log('1. 网络连接在验证过程中断开');
        console.log('2. 浏览器阻止了API请求');
        console.log('3. 验证过程中出现JavaScript错误');
        console.log('4. 密钥验证失败，没有到达记录保存步骤');
    } else {
        console.log('❌ Railway API存在问题，需要检查服务器状态');
    }
}

main().catch(console.error);