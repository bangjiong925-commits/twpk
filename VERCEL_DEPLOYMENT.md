# 台湾PK10项目 - Vercel部署指南

## 概述

本指南将帮助您将台湾PK10数据抓取和API服务部署到Vercel平台。项目支持：

- **Node.js API服务**：提供数据查询、统计等RESTful API
- **Python抓取器**：通过Vercel Functions运行定时数据抓取
- **静态网页**：数据展示和管理界面
- **MongoDB Atlas**：云数据库存储
- **自动化部署**：Git推送自动部署

## 部署架构

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vercel CDN    │    │  Vercel Functions │    │  MongoDB Atlas  │
│                 │    │                  │    │                 │
│ • 静态文件      │◄──►│ • Node.js API    │◄──►│ • 数据存储      │
│ • 网页界面      │    │ • Python抓取器   │    │ • 数据查询      │
│ • 资源缓存      │    │ • 定时任务       │    │ • 备份恢复      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 前置准备

### 1. Vercel账户设置

- 确保您已有Vercel账户
- 安装Vercel CLI（可选）：`npm i -g vercel`
- 连接GitHub仓库到Vercel

### 2. MongoDB Atlas设置

参考 `MONGODB_ATLAS_配置指南.md` 完成以下步骤：

1. 创建MongoDB Atlas账户
2. 创建集群和数据库
3. 配置网络访问（允许所有IP：0.0.0.0/0）
4. 创建数据库用户
5. 获取连接字符串

### 3. 项目文件检查

确保以下文件存在：
- ✅ `vercel.json` - Vercel配置文件
- ✅ `package.json` - Node.js依赖
- ✅ `requirements-vercel.txt` - Python依赖
- ✅ `.env.vercel` - 环境变量模板
- ✅ `api/scheduler.py` - Python Functions入口

## 部署步骤

### 步骤1：配置环境变量

在Vercel Dashboard中设置以下环境变量：

#### 必需环境变量

```bash
# MongoDB连接
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/taiwan_pk10?retryWrites=true&w=majority
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/taiwan_pk10?retryWrites=true&w=majority

# 数据库配置
DB_NAME=taiwan_pk10

# 应用配置
NODE_ENV=production
PORT=3000

# 时区配置
TZ=Asia/Taipei
```

#### 可选环境变量

```bash
# 抓取配置
SCRAPE_INTERVAL=75000
SCRAPE_START_HOUR=7
SCRAPE_END_HOUR=24
MAX_RECORDS_PER_FILE=1000

# API配置
API_RATE_LIMIT=100
API_TIMEOUT=30000
CORS_ORIGIN=*

# 错误处理
ERROR_RETRY_COUNT=3
ERROR_RETRY_DELAY=5000

# 日志配置
LOG_LEVEL=info
LOG_TO_FILE=false

# 缓存配置
CACHE_TTL=60
CACHE_ENABLED=true
```

### 步骤2：部署到Vercel

#### 方法1：通过Vercel Dashboard（推荐）

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "New Project"
3. 选择您的GitHub仓库
4. 配置项目设置：
   - **Framework Preset**: Other
   - **Root Directory**: `myyz`（如果项目在子目录）
   - **Build Command**: `npm run build`（如果有）
   - **Output Directory**: `dist`（如果有）
5. 添加环境变量（参考上面的列表）
6. 点击 "Deploy"

#### 方法2：通过Vercel CLI

```bash
# 进入项目目录
cd /path/to/your/project/myyz

# 登录Vercel
vercel login

# 初始化项目
vercel

# 设置环境变量
vercel env add MONGO_URL
vercel env add DATABASE_URL
vercel env add DB_NAME
# ... 添加其他环境变量

# 部署
vercel --prod
```

#### 方法3：通过Git推送（自动部署）

1. 将代码推送到GitHub
2. Vercel会自动检测并部署
3. 在Vercel Dashboard中查看部署状态

### 步骤3：验证部署

部署完成后，验证以下端点：

#### API端点测试

```bash
# 健康检查
curl https://your-project.vercel.app/health

# 最新数据
curl https://your-project.vercel.app/latest-data

# 历史数据
curl https://your-project.vercel.app/historical-data

# 数据统计
curl https://your-project.vercel.app/stats

# Python抓取器健康检查
curl https://your-project.vercel.app/scheduler?action=health

# 触发数据抓取
curl https://your-project.vercel.app/scheduler?action=scrape
```

#### 网页界面测试

访问以下页面：
- 主页：`https://your-project.vercel.app/`
- 数据展示：`https://your-project.vercel.app/index.html`
- 密钥管理：`https://your-project.vercel.app/key-management.html`

## 功能特性

### 1. 自动数据抓取

- **触发方式**：HTTP请求触发（Vercel不支持传统cron）
- **抓取频率**：可通过外部服务（如GitHub Actions、Uptime Robot）定时触发
- **数据验证**：自动检查重复数据，避免重复保存
- **错误处理**：完善的错误处理和重试机制

### 2. 数据库管理

- **分文件存储**：每个集合最多1000条数据
- **自动分片**：按日期和数据量自动创建新集合
- **数据查询**：支持按日期、期号、数量等条件查询
- **数据统计**：提供数据量、时间范围等统计信息

### 3. API服务

- **RESTful设计**：标准的REST API接口
- **CORS支持**：跨域请求支持
- **错误处理**：统一的错误响应格式
- **性能优化**：缓存和查询优化

### 4. 监控和日志

- **健康检查**：实时监控服务状态
- **错误报告**：详细的错误信息和堆栈跟踪
- **性能指标**：响应时间、成功率等指标
- **日志记录**：结构化日志输出

## 定时任务设置

由于Vercel Functions是无服务器的，不支持传统的cron任务。推荐以下方案：

### 方案1：GitHub Actions（推荐）

创建 `.github/workflows/scraper.yml`：

```yaml
name: Taiwan PK10 Data Scraper

on:
  schedule:
    # 每75秒运行一次（GitHub Actions最小间隔是5分钟）
    - cron: '*/5 * * * *'
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Scraper
        run: |
          curl -X GET "https://your-project.vercel.app/scheduler?action=scrape"
```

### 方案2：外部监控服务

使用Uptime Robot、Pingdom等服务：

1. 创建HTTP监控
2. 设置监控URL：`https://your-project.vercel.app/scheduler?action=scrape`
3. 设置检查间隔：1-5分钟
4. 启用监控

### 方案3：第三方Cron服务

使用cron-job.org、EasyCron等：

1. 注册账户
2. 创建新任务
3. 设置URL：`https://your-project.vercel.app/scheduler?action=scrape`
4. 设置执行间隔
5. 启用任务

## 故障排除

### 常见问题

#### 1. 部署失败

**问题**：构建或部署过程中出错

**解决方案**：
- 检查 `vercel.json` 配置是否正确
- 确认所有依赖都在 `package.json` 和 `requirements-vercel.txt` 中
- 查看Vercel Dashboard中的构建日志
- 确保Node.js版本兼容（>=18.0.0）

#### 2. 数据库连接失败

**问题**：无法连接到MongoDB Atlas

**解决方案**：
- 检查 `MONGO_URL` 环境变量是否正确设置
- 确认MongoDB Atlas网络访问设置（允许0.0.0.0/0）
- 验证数据库用户名和密码
- 检查集群状态是否正常

#### 3. Python Functions错误

**问题**：Python抓取器无法正常工作

**解决方案**：
- 检查 `requirements-vercel.txt` 中的依赖版本
- 确认Python代码兼容Vercel Functions环境
- 查看Function日志了解具体错误
- 测试本地Python环境是否正常

#### 4. API响应慢

**问题**：API请求响应时间过长

**解决方案**：
- 优化数据库查询（添加索引）
- 启用缓存机制
- 减少单次查询的数据量
- 使用分页查询

### 调试工具

#### 1. 日志查看

```bash
# 查看Function日志
vercel logs your-project-url

# 实时日志
vercel logs your-project-url --follow
```

#### 2. 本地测试

```bash
# 本地运行Vercel环境
vercel dev

# 测试API端点
curl http://localhost:3000/health
```

#### 3. 环境变量检查

```bash
# 列出环境变量
vercel env ls

# 查看特定环境变量
vercel env get MONGO_URL
```

## 性能优化

### 1. 冷启动优化

- 减少Python依赖包大小
- 使用轻量级HTTP客户端
- 优化导入语句
- 启用Function预热

### 2. 数据库优化

- 创建适当的索引
- 使用连接池
- 优化查询语句
- 启用数据压缩

### 3. 缓存策略

- 启用CDN缓存
- 使用内存缓存
- 设置合适的TTL
- 缓存热点数据

### 4. 监控和告警

- 设置性能监控
- 配置错误告警
- 监控资源使用
- 定期性能评估

## 安全考虑

### 1. 环境变量安全

- 不要在代码中硬编码敏感信息
- 使用Vercel环境变量管理
- 定期轮换数据库密码
- 限制数据库访问权限

### 2. API安全

- 启用CORS限制
- 实施速率限制
- 验证输入参数
- 记录访问日志

### 3. 数据安全

- 启用数据库加密
- 定期备份数据
- 监控异常访问
- 实施访问控制

## 维护和更新

### 1. 定期维护

- 更新依赖包版本
- 清理过期数据
- 优化数据库性能
- 检查安全漏洞

### 2. 监控指标

- 响应时间
- 错误率
- 数据抓取成功率
- 资源使用情况

### 3. 备份策略

- 自动数据备份
- 代码版本控制
- 配置文件备份
- 恢复流程测试

## 支持和帮助

如果遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查Vercel Dashboard中的日志
3. 查看MongoDB Atlas监控面板
4. 参考相关技术文档

---

**部署完成后，您的台湾PK10数据系统将具备：**

✅ **24/7云端运行**：无需本地服务器，全球CDN加速  
✅ **自动数据抓取**：通过外部定时服务触发数据抓取  
✅ **实时API服务**：高性能RESTful API接口  
✅ **智能数据管理**：自动分文件存储，支持大量数据  
✅ **完善监控**：健康检查、错误处理、性能监控  
✅ **安全可靠**：云数据库、环境变量管理、访问控制  

**立即开始部署，享受专业级的数据服务！** 🚀