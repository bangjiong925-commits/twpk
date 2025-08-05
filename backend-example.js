/*
跨平台密钥验证后端服务示例
使用Node.js + Express + Redis实现

安装依赖：
npm init -y
npm install express redis cors dotenv

运行：
node backend-example.js
*/

const express = require('express');
const redis = require('redis');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// Redis客户端配置 - 支持本地和云端
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
    console.error('Redis连接错误:', err);
});

// 连接Redis
redisClient.connect().then(() => {
    console.log('Redis连接成功');
}).catch((err) => {
    console.error('Redis连接失败:', err);
});

// 工具函数
function formatRemainingTime(remainingTime) {
    if (remainingTime <= 0) {
        return '0秒';
    }
    
    const seconds = Math.floor(remainingTime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}天${hours % 24}小时${minutes % 60}分钟`;
    } else if (hours > 0) {
        return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
        return `${minutes}分钟${seconds % 60}秒`;
    } else {
        return `${seconds}秒`;
    }
}

// API路由

// 检查nonce是否已被使用
app.get('/api/nonce/check/:nonce', async (req, res) => {
    try {
        const { nonce } = req.params;
        
        // 从Redis检查nonce是否存在
        const exists = await redisClient.exists(`used_nonce:${nonce}`);
        
        res.json({ 
            used: exists === 1,
            nonce: nonce,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('检查nonce失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 标记nonce为已使用
app.post('/api/nonce/mark', async (req, res) => {
    try {
        const { nonce } = req.body;
        
        if (!nonce) {
            return res.status(400).json({ error: 'nonce参数必需' });
        }
        
        // 检查nonce是否已存在
        const exists = await redisClient.exists(`used_nonce:${nonce}`);
        if (exists) {
            return res.status(409).json({ 
                error: 'nonce已被使用',
                used: true 
            });
        }
        
        // 标记nonce为已使用，设置30天过期时间
        await redisClient.setEx(`used_nonce:${nonce}`, 30 * 24 * 60 * 60, new Date().toISOString());
        
        res.json({ 
            success: true,
            nonce: nonce,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('标记nonce失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        redis: redisClient.isReady ? 'connected' : 'disconnected'
    });
});

// 获取统计信息（可选）
app.get('/api/stats', async (req, res) => {
    try {
        const keys = await redisClient.keys('used_nonce:*');
        res.json({
            totalUsedNonces: keys.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('获取统计失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 密钥记录管理API

// 获取所有密钥记录
app.get('/api/key-records', async (req, res) => {
    try {
        const keys = await redisClient.keys('key_record:*');
        const records = [];
        const now = new Date();
        
        for (const key of keys) {
            const record = await redisClient.get(key);
            if (record) {
                const parsedRecord = JSON.parse(record);
                
                // 计算剩余时间（毫秒）
                // 剩余时间 = 过期时间 - 当前时间
                // 始终使用密钥的实际过期时间，不论是否已被使用
                const expiryDate = new Date(parsedRecord.expiresAt || parsedRecord.expiryTime)
                const remainingTime = Math.max(0, expiryDate.getTime() - now.getTime());
                
                // 添加剩余时间字段
                parsedRecord.remainingTime = remainingTime;
                parsedRecord.remainingTimeFormatted = formatRemainingTime(remainingTime);
                
                records.push(parsedRecord);
            }
        }
        
        // 按创建时间排序
        records.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
        
        res.json(records);
    } catch (error) {
        console.error('获取密钥记录失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 添加密钥记录
app.post('/api/key-records', async (req, res) => {
    console.log('收到密钥记录请求:', req.body);
    try {
        const record = req.body;
        
        if (!record.keyId) {
            return res.status(400).json({ error: '缺少keyId参数' });
        }
        
        // 检查密钥是否已经被使用过
        const existingRecord = await redisClient.get(`key_record:${record.keyId}`);
        if (existingRecord) {
            const existing = JSON.parse(existingRecord);
            // 密钥已被使用过，返回409状态
            return res.status(409).json({ 
                error: '该密钥已被使用过',
                used: true,
                usedAt: existing.usedAt || existing.serverTimestamp
            });
        } else {
            // 新密钥记录
            record.serverTimestamp = new Date().toISOString();
            
            // 当密钥被验证使用时，设置usedAt为当前服务器时间
            if (record.usedAt || record.usedTime) {
                record.usedAt = record.usedAt || record.serverTimestamp;
                
                // 使用密钥的实际有效期，而不是固定的30天
                let expiryDate;
                if (record.expiryTime) {
                    // 使用密钥的实际有效期
                    expiryDate = new Date(record.expiryTime);
                } else {
                    // 如果没有提供有效期，则使用30天作为默认值
                    expiryDate = new Date(new Date(record.usedAt).getTime() + 30 * 24 * 60 * 60 * 1000);
                }
                
                const remainingTime = Math.max(0, expiryDate.getTime() - new Date(record.serverTimestamp).getTime());
                
                // 保存剩余时间信息
                record.remainingTime = remainingTime;
                record.remainingTimeFormatted = formatRemainingTime(remainingTime);
                record.expiresAt = expiryDate.toISOString(); // 保存过期时间
            }
        }
        
        // 存储到Redis，使用固定的7天TTL来保留过期密钥记录
        // 这样过期的密钥仍然会在管理页面显示为已过期状态，而不是消失
        const redisTTL = 7 * 24 * 60 * 60; // 固定7天，让过期密钥也能在管理页面查看
        
        await redisClient.setEx(
            `key_record:${record.keyId}`, 
            redisTTL, 
            JSON.stringify(record)
        );
        
        res.json({ 
            success: true,
            keyId: record.keyId,
            timestamp: record.serverTimestamp || new Date().toISOString(),
            usedAt: record.usedAt,
            remainingTime: record.remainingTime,
            remainingTimeFormatted: record.remainingTimeFormatted
        });
    } catch (error) {
        console.error('保存密钥记录失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 检查密钥是否已被使用（在线验证）
app.get('/api/key-records/check/:nonce', async (req, res) => {
    try {
        const { nonce } = req.params;
        
        // 检查nonce是否已被使用
        const usedNonce = await redisClient.get(`used_nonce:${nonce}`);
        
        res.json({ 
            used: !!usedNonce,
            timestamp: usedNonce ? JSON.parse(usedNonce).timestamp : null
        });
    } catch (error) {
        console.error('检查密钥使用状态失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 标记密钥为已使用（在线标记）
app.post('/api/key-records/mark-used', async (req, res) => {
    try {
        const { nonce } = req.body;
        
        if (!nonce) {
            return res.status(400).json({ error: '缺少nonce参数' });
        }
        
        // 检查nonce是否已被使用
        const existingNonce = await redisClient.get(`used_nonce:${nonce}`);
        if (existingNonce) {
            return res.status(409).json({ 
                error: '该密钥已被使用过',
                used: true,
                timestamp: JSON.parse(existingNonce).timestamp
            });
        }
        
        // 标记nonce为已使用，设置30天过期时间
        const timestamp = new Date().toISOString();
        await redisClient.setEx(
            `used_nonce:${nonce}`, 
            30 * 24 * 60 * 60, 
            JSON.stringify({ timestamp, nonce })
        );
        
        res.json({ 
            success: true,
            nonce: nonce,
            timestamp: timestamp
        });
    } catch (error) {
        console.error('标记密钥使用失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 删除密钥记录
app.delete('/api/key-records/:keyId', async (req, res) => {
    try {
        const { keyId } = req.params;
        
        const result = await redisClient.del(`key_record:${keyId}`);
        
        if (result === 1) {
            res.json({ 
                success: true,
                message: '记录删除成功',
                keyId: keyId
            });
        } else {
            res.status(404).json({ error: '记录不存在' });
        }
    } catch (error) {
        console.error('删除密钥记录失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 清空所有密钥记录
app.delete('/api/key-records', async (req, res) => {
    try {
        const keys = await redisClient.keys('key_record:*');
        
        if (keys.length > 0) {
            await redisClient.del(keys);
        }
        
        res.json({ 
            success: true,
            message: `已清空 ${keys.length} 条记录`,
            deletedCount: keys.length
        });
    } catch (error) {
        console.error('清空密钥记录失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 获取密钥使用统计
app.get('/api/key-stats', async (req, res) => {
    try {
        const keys = await redisClient.keys('key_record:*');
        const records = [];
        
        for (const key of keys) {
            const record = await redisClient.get(key);
            if (record) {
                records.push(JSON.parse(record));
            }
        }
        
        const now = new Date();
        const stats = {
            total: records.length,
            used: 0,
            active: 0,
            expired: 0
        };
        
        records.forEach(record => {
            const expiryDate = new Date(record.expiryTime);
            if (record.usedTime) {
                stats.used++;
            } else if (expiryDate < now) {
                stats.expired++;
            } else {
                stats.active++;
            }
        });
        
        res.json({
            ...stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('获取密钥统计失败:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 启动服务器（本地开发）或导出应用（Vercel部署）
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, '0.0.0.0', () => {
        console.log(`跨平台密钥验证服务运行在端口 ${port}`);
        console.log(`本地访问: http://localhost:${port}/health`);
        console.log(`局域网访问: http://192.168.31.161:${port}/health`);
        console.log(`API文档:`);
        console.log(`  GET  /api/nonce/check/:nonce - 检查nonce是否已使用`);
        console.log(`  POST /api/nonce/mark - 标记nonce为已使用`);
        console.log(`  GET  /api/stats - 获取使用统计`);
        console.log(`  GET  /api/key-records - 获取密钥记录`);
        console.log(`  POST /api/key-records - 创建密钥记录`);
    });
}

// 导出应用供Vercel使用
module.exports = app;

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('正在关闭服务器...');
    await redisClient.quit();
    process.exit(0);
});

/*
部署到免费云服务的步骤：

1. Vercel部署：
   - 创建vercel.json配置文件
   - 使用Vercel CLI: vercel --prod
   - 配置环境变量REDIS_URL

2. Railway部署：
   - 连接GitHub仓库
   - 添加Redis插件
   - 自动部署

3. Render部署：
   - 连接GitHub仓库
   - 添加Redis实例
   - 配置环境变量

4. 前端代码修改：
   将TWPK.html中的API调用地址改为实际的后端服务地址
   例如：https://your-service.vercel.app/api/nonce/check/
*/