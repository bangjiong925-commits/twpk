# 跨平台密钥一次性验证实现指南

## 概述

本项目已实现基础的密钥一次性验证功能，目前使用 `localStorage` 确保在同一浏览器中密钥只能使用一次。要实现真正的跨平台验证（不同设备、不同浏览器），需要部署后端服务。

## 当前实现状态

✅ **已完成功能：**
- 密钥格式验证（Base64 + JSON）
- 过期时间检查
- 设备指纹验证
- 本地一次性使用验证（localStorage）
- 云端API调用框架

🔄 **需要完善：**
- 部署真实的后端验证服务
- 配置云端数据库存储

## 快速部署后端服务

### 方案一：使用免费云服务（推荐）

#### 1. Vercel + Redis Cloud

```bash
# 1. 安装依赖
npm install

# 2. 创建 vercel.json
echo '{
  "version": 2,
  "builds": [
    {
      "src": "backend-example.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/backend-example.js"
    }
  ]
}' > vercel.json

# 3. 部署到 Vercel
npx vercel --prod
```

#### 2. Railway 部署（一键部署）

1. 访问 [Railway](https://railway.app)
2. 连接 GitHub 仓库
3. 添加 Redis 插件
4. 自动部署完成

#### 3. Render 部署

1. 访问 [Render](https://render.com)
2. 创建新的 Web Service
3. 连接 GitHub 仓库
4. 添加 Redis 实例
5. 配置环境变量 `REDIS_URL`

### 方案二：本地开发测试

```bash
# 1. 安装 Redis（macOS）
brew install redis
brew services start redis

# 2. 安装项目依赖
npm install

# 3. 启动开发服务器
npm run dev
```

## 前端配置修改

部署后端服务后，需要修改 `TWPK.html` 中的 API 地址：

```javascript
// 在 checkNonceUsed 函数中
const response = await fetch(`https://your-backend-url.vercel.app/api/nonce/check/${encodeURIComponent(nonce)}`, {
    method: 'GET',
    headers: {
        'User-Agent': 'TWPK-KeyValidator/1.0'
    }
});

// 在 markNonceAsUsed 函数中
const response = await fetch(`https://your-backend-url.vercel.app/api/nonce/mark`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TWPK-KeyValidator/1.0'
    },
    body: JSON.stringify({ 
        nonce: nonce,
        timestamp: new Date().toISOString()
    })
});
```

## API 接口说明

### 检查 nonce 是否已使用
```http
GET /api/nonce/check/:nonce
```

**响应：**
```json
{
  "used": false,
  "nonce": "abc123",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

### 标记 nonce 为已使用
```http
POST /api/nonce/mark
Content-Type: application/json

{
  "nonce": "abc123"
}
```

**响应：**
```json
{
  "success": true,
  "nonce": "abc123",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

### 健康检查
```http
GET /health
```

### 使用统计
```http
GET /api/stats
```

## 安全考虑

1. **速率限制**：建议添加 API 调用频率限制
2. **HTTPS**：确保所有 API 调用使用 HTTPS
3. **CORS 配置**：正确配置跨域访问策略
4. **数据过期**：nonce 数据设置合理的过期时间（默认30天）
5. **监控日志**：记录异常访问和错误日志

## 测试验证

1. **生成密钥**：使用 `key generator.html` 生成测试密钥
2. **首次验证**：在 `TWPK.html` 中验证密钥，应该成功
3. **重复验证**：再次使用相同密钥，应该提示"密钥已被使用"
4. **跨设备测试**：在不同设备/浏览器中测试相同密钥

## 故障排除

### 常见问题

1. **Redis 连接失败**
   - 检查 `REDIS_URL` 环境变量
   - 确认 Redis 服务正常运行

2. **CORS 错误**
   - 检查后端 CORS 配置
   - 确认前端域名在允许列表中

3. **API 调用失败**
   - 检查网络连接
   - 查看浏览器控制台错误信息
   - 验证 API 地址是否正确

### 调试模式

在浏览器控制台中启用详细日志：

```javascript
// 在浏览器控制台中执行
localStorage.setItem('debug', 'true');
```

## 生产环境建议

1. **数据库选择**：
   - Redis：适合高频访问，内存存储
   - MongoDB：适合持久化存储，复杂查询
   - PostgreSQL：适合关系型数据，ACID 保证

2. **缓存策略**：
   - 使用 CDN 加速 API 响应
   - 实现本地缓存减少网络请求

3. **监控告警**：
   - 设置 API 响应时间监控
   - 配置错误率告警
   - 监控数据库连接状态

4. **备份恢复**：
   - 定期备份 nonce 数据
   - 制定灾难恢复计划

## 联系支持

如果在部署过程中遇到问题，请检查：
1. 后端服务日志
2. 浏览器控制台错误
3. 网络连接状态
4. API 接口响应

---

**注意**：当前版本已包含完整的跨平台验证框架，只需要部署后端服务即可实现真正的跨平台密钥一次性验证功能。