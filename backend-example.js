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

// 启动服务器（本地开发）或导出应用（Vercel部署）
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`跨平台密钥验证服务运行在端口 ${port}`);
        console.log(`健康检查: http://localhost:${port}/health`);
        console.log(`API文档:`);
        console.log(`  GET  /api/nonce/check/:nonce - 检查nonce是否已使用`);
        console.log(`  POST /api/nonce/mark - 标记nonce为已使用`);
        console.log(`  GET  /api/stats - 获取使用统计`);
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