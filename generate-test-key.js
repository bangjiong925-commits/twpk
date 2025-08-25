// 测试密钥生成器
// 生成符合短密钥格式的测试密钥

// Base62编码字符集
const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Base62编码函数
function base62Encode(bytes) {
    const base = BigInt(chars.length);
    let result = BigInt(0);
    
    // 将字节数组转换为大整数
    for (let i = 0; i < bytes.length; i++) {
        result = result * BigInt(256) + BigInt(bytes[i]);
    }
    
    // 转换为Base62
    let encoded = '';
    while (result > 0) {
        encoded = chars[Number(result % base)] + encoded;
        result = result / base;
    }
    
    return encoded || '0';
}

// 简化的PBKDF2实现（用于生成哈希）
async function simplePBKDF2(password, salt, iterations, keyLength) {
    // Node.js环境下的实现
    const crypto = await import('crypto');
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, derivedKey) => {
            if (err) reject(err);
            else resolve(new Uint8Array(derivedKey));
        });
    });
}

// 生成测试密钥
async function generateTestKey(validDays = 30) {
    try {
        // 计算过期时间戳（当前时间 + validDays天）
        const currentTime = Math.floor(Date.now() / 1000);
        const expiry = currentTime + (validDays * 24 * 60 * 60);
        
        console.log(`生成密钥，有效期：${validDays}天`);
        console.log(`过期时间：${new Date(expiry * 1000).toLocaleString()}`);
        
        // 创建16字节的密钥数据
        const keyData = new Uint8Array(16);
        
        // 前4字节：时间戳
        keyData[0] = (expiry >>> 24) & 0xFF;
        keyData[1] = (expiry >>> 16) & 0xFF;
        keyData[2] = (expiry >>> 8) & 0xFF;
        keyData[3] = expiry & 0xFF;
        
        // 使用确定性盐（基于时间戳）
        const deterministicSalt = new Uint8Array(8);
        deterministicSalt[0] = (expiry >>> 24) & 0xFF;
        deterministicSalt[1] = (expiry >>> 16) & 0xFF;
        deterministicSalt[2] = (expiry >>> 8) & 0xFF;
        deterministicSalt[3] = expiry & 0xFF;
        deterministicSalt[4] = (expiry >>> 24) & 0xFF;
        deterministicSalt[5] = (expiry >>> 16) & 0xFF;
        deterministicSalt[6] = (expiry >>> 8) & 0xFF;
        deterministicSalt[7] = expiry & 0xFF;
        
        // 使用相同的主密钥计算PBKDF2哈希
        const masterKey = 'TWPK_SECURE_KEY_2024';
        const computedHash = await simplePBKDF2(masterKey + expiry, deterministicSalt, 10000, 12);
        
        // 后12字节：哈希值
        for (let i = 0; i < 12; i++) {
            keyData[4 + i] = computedHash[i];
        }
        
        // Base62编码
        const encodedKey = base62Encode(keyData);
        
        console.log(`生成的测试密钥：${encodedKey}`);
        console.log(`密钥长度：${encodedKey.length}`);
        
        return {
            key: encodedKey,
            expiry: expiry,
            expiryDate: new Date(expiry * 1000).toLocaleString(),
            nonce: encodedKey.slice(0, 16)
        };
    } catch (error) {
        console.error('生成测试密钥失败:', error);
        throw error;
    }
}

// 如果直接运行此文件
if (process.argv[1] && process.argv[1].endsWith('generate-test-key.js')) {
    (async () => {
        try {
            console.log('开始生成测试密钥...');
            const testKey = await generateTestKey(30); // 生成30天有效期的密钥
            console.log('\n=== 测试密钥信息 ===');
            console.log(`密钥：${testKey.key}`);
            console.log(`过期时间：${testKey.expiryDate}`);
            console.log(`Nonce：${testKey.nonce}`);
            console.log('\n请复制上面的密钥用于测试');
        } catch (error) {
            console.error('生成失败:', error);
        }
    })();
}

export { generateTestKey };