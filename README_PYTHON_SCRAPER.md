# 台湾PK10数据抓取工具 (Python版)

这是一个用Python开发的台湾PK10数据抓取工具，用于替代原有的JavaScript抓取器，提供更稳定和可靠的数据抓取服务。

## 功能特性

- 🚀 **高效抓取**: 使用Selenium WebDriver进行网页数据抓取
- 📊 **数据管理**: MongoDB数据库存储和管理
- ⏰ **定时任务**: 支持定时自动抓取数据
- 🔄 **API同步**: 与现有Web应用API接口同步
- 📝 **日志记录**: 完整的日志记录和错误追踪
- 🛡️ **错误处理**: 健壮的错误处理和重试机制
- 📈 **性能监控**: 内置性能监控和统计
- 🔧 **配置灵活**: 支持多种配置方式

## 项目结构

```
├── main.py                 # 主程序入口
├── python_scraper.py       # 数据抓取模块
├── database_manager.py     # 数据库管理模块
├── api_client.py           # API客户端模块
├── scheduler.py            # 任务调度模块
├── error_handler.py        # 错误处理模块
├── config.json             # 配置文件
├── .env.example            # 环境变量模板
├── requirements.txt        # Python依赖包
└── logs/                   # 日志目录
```

## 安装和配置

### 1. 环境要求

- Python 3.8+
- MongoDB 4.0+
- Chrome浏览器
- Node.js (用于现有Web应用)

### 2. 安装依赖

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装依赖包
pip install -r requirements.txt
```

### 3. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
vim .env
```

主要配置项：

```bash
# MongoDB连接
MONGO_URL=mongodb://localhost:27017/taiwan_pk10

# API服务器地址
API_BASE_URL=http://localhost:3000

# 抓取配置
SCRAPING_HEADLESS=true
SCRAPING_MAX_PAGES=5

# 调度配置
ENABLE_SCHEDULER=true
SCRAPING_INTERVAL=30
```

### 4. 配置文件

编辑 `config.json` 文件来自定义详细配置：

```json
{
  "scraping": {
    "headless": true,
    "max_pages": 5,
    "timeout": 30
  },
  "database": {
    "connection_timeout": 10000,
    "cleanup_days": 30
  },
  "scheduling": {
    "scraping_interval": 30,
    "cleanup_hour": 2
  }
}
```

## 使用方法

### 1. 单次抓取

抓取今日数据：

```bash
python main.py --mode single
```

### 2. 定时抓取服务

启动定时抓取服务：

```bash
python main.py --mode scheduled
```

### 3. 历史数据抓取

抓取指定日期范围的历史数据：

```bash
python main.py --mode historical --start-date 2024-01-01 --end-date 2024-01-07
```

### 4. 查看状态

查看应用运行状态：

```bash
python main.py --mode status
```

### 5. 高级选项

```bash
# 指定最大抓取页数
python main.py --mode single --max-pages 10

# 设置日志级别
python main.py --mode single --log-level DEBUG

# 使用自定义配置文件
python main.py --mode single --config-file custom_config.json

# 非无头模式运行（显示浏览器窗口）
python main.py --mode single --headless false
```

## 模块说明

### 1. 数据抓取模块 (python_scraper.py)

- 使用Selenium WebDriver自动化浏览器
- 支持日期选择和分页抓取
- 数据解析和格式化
- 错误处理和重试机制

### 2. 数据库管理模块 (database_manager.py)

- MongoDB连接和配置
- 数据保存和查询
- 索引管理
- 数据清理和统计

### 3. API客户端模块 (api_client.py)

- 与Web应用API通信
- 数据同步和更新
- 健康检查和状态监控

### 4. 任务调度模块 (scheduler.py)

- 定时任务管理
- 支持APScheduler和schedule库
- 任务状态监控

### 5. 错误处理模块 (error_handler.py)

- 统一错误处理
- 日志记录和管理
- 错误统计和报告

## 监控和维护

### 1. 日志查看

```bash
# 查看最新日志
tail -f logs/scraper_$(date +%Y-%m-%d).log

# 查看错误日志
grep "ERROR" logs/scraper_*.log
```

### 2. 数据库维护

```bash
# 连接MongoDB查看数据
mongo taiwan_pk10

# 查看数据统计
db.taiwan_pk10_data.count()
db.taiwan_pk10_data.find().limit(5)
```

### 3. 性能监控

应用内置性能监控，可以通过状态接口查看：

```bash
python main.py --mode status
```

## 故障排除

### 1. 常见问题

**Chrome浏览器问题**:
```bash
# 安装Chrome浏览器
# Ubuntu/Debian
sudo apt-get install google-chrome-stable

# 或者指定Chrome路径
export CHROME_BINARY_PATH=/path/to/chrome
```

**MongoDB连接问题**:
```bash
# 检查MongoDB服务状态
sudo systemctl status mongod

# 启动MongoDB服务
sudo systemctl start mongod
```

**依赖包问题**:
```bash
# 重新安装依赖
pip install --upgrade -r requirements.txt

# 清理pip缓存
pip cache purge
```

### 2. 调试模式

```bash
# 启用调试模式
export DEBUG=true
export VERBOSE_LOGGING=true

# 运行调试
python main.py --mode single --log-level DEBUG
```

### 3. 错误日志分析

```bash
# 查看错误统计
grep -c "ERROR" logs/scraper_*.log

# 查看特定错误
grep "ScrapingError" logs/scraper_*.log
```

## 部署建议

### 1. 生产环境部署

```bash
# 使用systemd服务
sudo cp scraper.service /etc/systemd/system/
sudo systemctl enable scraper
sudo systemctl start scraper
```

### 2. Docker部署

```dockerfile
FROM python:3.9-slim

# 安装Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["python", "main.py", "--mode", "scheduled"]
```

### 3. 监控和告警

- 设置日志监控
- 配置错误告警
- 监控数据库性能
- 设置健康检查

## API接口

与现有Web应用的API接口兼容：

- `GET /api/health` - 健康检查
- `POST /api/manual-fetch-today` - 手动抓取今日数据
- `POST /api/taiwan-pk10/update` - 更新数据
- `GET /api/taiwan-pk10/latest` - 获取最新数据
- `GET /api/taiwan-pk10/date/:date` - 按日期获取数据

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交Issue或联系开发团队。