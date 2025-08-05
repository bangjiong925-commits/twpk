# TWPK 密钥验证系统

一个跨平台的密钥验证系统，支持本地和云端验证，具备智能API地址检测功能。

## 功能特性

- 🔐 密钥验证和管理
- 🌐 跨平台支持（桌面端、移动端）
- ☁️ 云端同步和本地备份
- 🔄 智能API地址检测
- 📊 密钥使用统计
- 🚀 支持Vercel部署

## 部署到Vercel

### 1. 准备工作

确保你的项目包含以下文件：
- `vercel.json` - Vercel配置文件
- `package.json` - 依赖配置
- `/api/` 目录下的Serverless Functions

### 2. 设置环境变量

在Vercel项目设置中添加以下环境变量：

```
KV_REST_API_URL=your_vercel_kv_url
KV_REST_API_TOKEN=your_vercel_kv_token
```

### 3. 部署步骤

1. 将代码推送到GitHub仓库
2. 在Vercel中导入项目
3. 配置环境变量
4. 部署完成

### 4. API端点

部署后，以下API端点将可用：

- `GET /api/health` - 健康检查
- `GET /api/key-records` - 获取密钥记录
- `POST /api/key-records` - 创建密钥记录
- `GET /api/nonce/check/[nonce]` - 检查nonce状态
- `POST /api/nonce/mark` - 标记nonce为已使用
- `GET /api/stats` - 获取统计信息

## 智能API检测

系统会自动检测并连接到可用的API服务器：

1. `http://localhost:3000` - 本地开发环境
2. `http://192.168.31.161:3000` - 局域网环境
3. `https://myyz.vercel.app` - 生产环境
4. `https://myyz-api.vercel.app` - 备用生产环境