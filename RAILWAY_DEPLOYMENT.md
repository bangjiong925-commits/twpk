# 台湾PK10数据系统 - Railway部署指南

## 概述

本文档详细说明如何将台湾PK10数据抓取系统部署到Railway平台。该系统包含Node.js API服务器和Python数据抓取服务，支持自动化数据收集、存储和API访问。

## 系统架构

```
台湾PK10数据系统
├── Node.js API服务器 (web服务)
│   ├── Express.js API
│   ├── MongoDB连接
│   ├── 静态文件服务
│   └── 健康检查端点
└── Python数据抓取服务 (worker服务)
    ├── 智能定时抓取
    ├── 数据验证和存储
    ├── 错误处理和重试
    └── 日志记录
```

## 部署前准备

### 1. 环境要求

- Node.js 18+
- Python 3.11+
- Railway CLI
- MongoDB数据库（Railway提供）

### 2. 安装Railway CLI

```bash
npm install -g @railway/cli
```

### 3. 登录Railway

```bash
railway login
```

## 快速部署

### 方法一：使用自动化脚本（推荐）

```bash
# 给脚本执行权限
chmod +x deploy_railway.sh

# 运行部署脚本
./deploy_railway.sh
```

脚本会自动完成以下步骤：
1. 检查依赖和项目文件
2. 验证配置文件
3. 安装项目依赖
4. 设置Railway项目
5. 配置环境变量
6. 执行部署
7. 验证部署结果

### 方法二：手动部署

#### 步骤1：初始化Railway项目

```bash
railway init
```

#### 步骤2：配置环境变量

在Railway Dashboard中配置以下环境变量：

**基础环境变量：**
```
NODE_ENV=production
PORT=3000
TZ=Asia/Shanghai
```

**Python环境变量：**
```
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
PYTHONPATH=/app
```

**Chrome/Selenium配置：**
```
CHROME_BIN=/usr/bin/chromium
CHROMEDRIVER_PATH=/usr/bin/chromedriver
CHROME_NO_SANDBOX=true
DISPLAY=:99
```

**数据抓取配置：**
```
SCRAPE_SCHEDULE_START=07:05
SCRAPE_SCHEDULE_END=24:00
SCRAPE_INTERVAL_SECONDS=75
MAX_RETRIES=3
TIMEOUT_SECONDS=30
```

**日志配置：**
```
LOG_LEVEL=INFO
LOG_FILE_PATH=/tmp/auto_scheduler.log
LOG_MAX_SIZE=10MB
LOG_BACKUP_COUNT=5
```

#### 步骤3：添加MongoDB插件

```bash
railway add mongodb
```

#### 步骤4：部署应用

```bash
railway up
```

## 配置文件说明

### railway.toml

主要配置文件，定义了构建和部署设置：

```toml
[build]
provider = "nixpacks"

[deploy]
startCommand = "npm start"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[environments.production.variables]
NODE_ENV = "production"
PORT = "3000"
# ... 其他环境变量
```

### nixpacks.toml

构建配置，支持Node.js和Python混合环境：

```toml
[phases.setup]
nixPkgs = ["nodejs_18", "python311", "chromium", "chromedriver"]

[phases.install]
cmds = [
  "npm ci",
  "pip install -r requirements.txt"
]

[start]
cmd = "npm start"
```

### Procfile

进程定义文件：

```
web: npm start
worker: python3 railway_python_start.py
```

## 服务监控

### 健康检查

系统提供多个健康检查端点：

- **API健康检查：** `GET /health`
- **数据库连接检查：** `GET /api/health/database`
- **系统状态检查：** 运行 `python3 health_check.py`

### 日志监控

```bash
# 查看实时日志
railway logs

# 查看特定服务日志
railway logs --service web
railway logs --service worker
```

### 服务状态

```bash
# 查看服务状态
railway status

# 查看运行的进程
railway ps
```

## 故障排除

### 常见问题

#### 1. Python服务启动失败

**症状：** Worker服务无法启动

**解决方案：**
```bash
# 检查Python依赖
railway run python3 -c "import selenium, pymongo, schedule"

# 检查Chrome配置
railway run python3 -c "from selenium import webdriver; print('Chrome OK')"
```

#### 2. 数据库连接失败

**症状：** API返回数据库连接错误

**解决方案：**
1. 检查MongoDB插件是否正确添加
2. 验证DATABASE_URL环境变量
3. 检查网络连接

```bash
# 测试数据库连接
railway run node -e "console.log(process.env.DATABASE_URL)"
```

#### 3. 内存不足

**症状：** 服务频繁重启，OOM错误

**解决方案：**
1. 优化Chrome配置
2. 增加内存限制
3. 启用内存优化选项

```bash
# 检查内存使用
railway run python3 health_check.py
```

#### 4. 定时任务不执行

**症状：** 数据抓取停止

**解决方案：**
1. 检查时区设置
2. 验证定时任务配置
3. 查看Python服务日志

### 调试命令

```bash
# 进入Railway容器
railway shell

# 运行健康检查
railway run python3 health_check.py

# 手动运行抓取
railway run python3 auto_scheduler.py

# 测试API端点
curl https://your-app.railway.app/health
```

## 性能优化

### 1. 内存优化

```bash
# 设置Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=512"

# 优化Chrome内存使用
export CHROME_ARGS="--memory-pressure-off --max_old_space_size=512"
```

### 2. 网络优化

```bash
# 启用连接池
export MONGO_POOL_SIZE=5

# 设置超时时间
export REQUEST_TIMEOUT=30000
```

### 3. 缓存优化

```bash
# 启用Redis缓存（可选）
railway add redis
```

## 扩展配置

### 自定义域名

1. 在Railway Dashboard中添加自定义域名
2. 配置DNS记录
3. 启用HTTPS

### 环境分离

```bash
# 创建staging环境
railway environment create staging

# 部署到staging
railway up --environment staging
```

### 数据备份

```bash
# 导出数据
railway run mongodump --uri $DATABASE_URL

# 导入数据
railway run mongorestore --uri $DATABASE_URL
```

## 安全配置

### 1. 环境变量安全

- 不要在代码中硬编码敏感信息
- 使用Railway的环境变量管理
- 定期轮换API密钥

### 2. 网络安全

- 启用HTTPS
- 配置CORS策略
- 限制API访问频率

### 3. 数据安全

- 启用MongoDB认证
- 配置数据库访问控制
- 定期备份数据

## 维护指南

### 日常维护

1. **监控服务状态**
   ```bash
   railway status
   ```

2. **检查日志**
   ```bash
   railway logs --tail 100
   ```

3. **运行健康检查**
   ```bash
   railway run python3 health_check.py
   ```

### 定期维护

1. **更新依赖**
   ```bash
   npm update
   pip install -r requirements.txt --upgrade
   ```

2. **清理日志**
   ```bash
   railway run rm -f /tmp/*.log
   ```

3. **数据库维护**
   ```bash
   railway run python3 -c "from database_manager import DatabaseManager; db = DatabaseManager(); db.cleanup_old_data()"
   ```

## 成本优化

### 1. 资源使用优化

- 合理设置内存限制
- 优化数据库查询
- 使用连接池

### 2. 服务休眠

```bash
# 在非工作时间暂停worker服务
railway service pause worker

# 恢复服务
railway service resume worker
```

## 联系支持

如果遇到问题，可以：

1. 查看Railway文档：https://docs.railway.app
2. 检查系统日志和健康检查报告
3. 联系技术支持

## 更新日志

- **v1.0.0** - 初始版本，支持基本的数据抓取和API服务
- **v1.1.0** - 添加健康检查和监控功能
- **v1.2.0** - 优化内存使用和错误处理
- **v1.3.0** - 添加自动化部署脚本

---

**注意：** 部署前请确保所有环境变量都已正确配置，特别是数据库连接和Chrome/Selenium相关配置。