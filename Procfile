# Railway Procfile - 台湾PK10数据抓取系统
# 定义多个服务进程

# 主Web服务 - Node.js API服务器
web: npm start

# Python数据抓取服务 - 后台运行
worker: python3 railway_python_start.py

# 备用启动方式
# web: node server.js
# worker: python3 auto_scheduler.py