// 通过API清除所有密钥记录
const http = require('http');

async function clearAllKeyRecords() {
  try {
    console.log('🔍 正在获取所有密钥记录...');
    
    // 首先获取所有记录
    const records = await makeRequest('GET', '/api/key-records');
    
    if (!records || records.length === 0) {
      console.log('✅ 数据库中没有密钥记录需要清除');
      return;
    }
    
    console.log(`📊 找到 ${records.length} 条密钥记录`);
    
    // 逐个删除记录
    let deletedCount = 0;
    for (const record of records) {
      try {
        await makeRequest('DELETE', `/api/key-records/${encodeURIComponent(record.keyId)}`);
        deletedCount++;
        console.log(`🗑️ 已删除记录: ${record.keyId}`);
      } catch (error) {
        console.error(`❌ 删除记录 ${record.keyId} 失败:`, error.message);
      }
    }
    
    console.log(`✅ 成功删除 ${deletedCount}/${records.length} 条记录`);
    
    // 验证清除结果
    const remainingRecords = await makeRequest('GET', '/api/key-records');
    console.log(`📊 清除后剩余记录数: ${remainingRecords ? remainingRecords.length : 0}`);
    
  } catch (error) {
    console.error('❌ 清除密钥记录时出错:', error);
  }
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = responseData ? JSON.parse(responseData) : null;
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`请求失败: ${error.message}`));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// 执行清除操作
clearAllKeyRecords().then(() => {
  console.log('🎉 清除操作完成');
  process.exit(0);
}).catch(error => {
  console.error('💥 清除操作失败:', error);
  process.exit(1);
});