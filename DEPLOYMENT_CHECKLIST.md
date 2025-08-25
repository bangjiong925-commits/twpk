# 台湾PK10项目 - Vercel部署验证清单

## 🚀 快速验证步骤

### 1. 部署前检查
- [ ] MongoDB Atlas已配置并可连接
- [ ] 环境变量已在Vercel Dashboard中设置
- [ ] 所有必要文件已提交到Git仓库
- [ ] `vercel.json`配置文件存在且正确

### 2. 部署执行
```bash
# 使用部署脚本（推荐）
./deploy.sh production

# 或手动部署
vercel --prod
```

### 3. 自动化测试
```bash
# 运行完整测试套件
node test-deployment.js https://your-project.vercel.app

# 示例输出
# [INFO] 开始测试部署: https://your-project.vercel.app
# [INFO] 总共 11 个测试用例
# [SUCCESS] ✓ 主页访问 (245ms)
# [SUCCESS] ✓ 健康检查端点 (189ms)
# ...
# [SUCCESS] 🎉 所有测试通过！部署验证成功！
```

### 4. 手动验证清单

#### 🌐 前端页面
- [ ] **主页** (`/`) - 显示最新PK10数据
- [ ] **数据展示页** (`/index.html`) - 完整数据表格
- [ ] **密钥管理页** (`/key-management.html`) - 管理界面

#### 🔌 API端点
- [ ] **健康检查** (`/health`) - 返回系统状态
- [ ] **最新数据** (`/latest-data`) - 返回最新期号数据
- [ ] **历史数据** (`/historical-data`) - 返回历史数据列表
- [ ] **数据统计** (`/stats`) - 返回数据库统计信息

#### 🐍 Python Functions
- [ ] **抓取器健康检查** (`/scheduler?action=health`) - Python环境状态
- [ ] **抓取器状态** (`/scheduler?action=status`) - 最新数据状态
- [ ] **手动触发抓取** (`/scheduler?action=scrape`) - 执行数据抓取

#### 📊 数据验证
- [ ] 数据格式正确（包含期号、开奖号码、时间等）
- [ ] 数据实时更新（最新期号与官网一致）
- [ ] 历史数据完整（可查询过往记录）
- [ ] 数据库连接正常（MongoDB Atlas）

### 5. 性能检查
- [ ] 页面加载时间 < 3秒
- [ ] API响应时间 < 2秒
- [ ] Python Functions冷启动 < 10秒
- [ ] 数据库查询响应 < 1秒

### 6. 功能测试

#### 数据抓取功能
```bash
# 测试手动抓取
curl "https://your-project.vercel.app/scheduler?action=scrape"

# 预期响应
{
  "status": "success",
  "message": "数据抓取完成",
  "data": {
    "new_records": 1,
    "latest_period": "20240115001"
  }
}
```

#### API数据格式验证
```bash
# 测试最新数据API
curl "https://your-project.vercel.app/latest-data"

# 预期响应格式
{
  "success": true,
  "data": [
    {
      "期号": "20240115001",
      "开奖号码": "01,05,03,08,02,07,04,10,06,09",
      "开奖时间": "2024-01-15 09:05:00",
      "总和": 55,
      "大小": "小",
      "单双": "单",
      "龙虎": "虎"
    }
  ],
  "total": 1,
  "page": 1
}
```

### 7. 错误处理验证
- [ ] 404页面正确显示
- [ ] API错误返回适当的错误信息
- [ ] 数据库连接失败时的降级处理
- [ ] Python Functions超时处理

### 8. 安全检查
- [ ] 敏感信息不在客户端暴露
- [ ] API端点有适当的访问控制
- [ ] 数据库连接使用安全配置
- [ ] CORS设置正确

### 9. 监控设置
- [ ] Vercel Analytics已启用
- [ ] 错误日志可正常查看
- [ ] 性能指标监控正常
- [ ] GitHub Actions定时任务运行正常

### 10. 文档和维护
- [ ] 部署文档完整且准确
- [ ] 环境变量文档更新
- [ ] API文档与实际接口一致
- [ ] 故障排除指南可用

## 🔧 常见问题排查

### 部署失败
1. 检查`vercel.json`语法
2. 确认所有依赖已安装
3. 验证环境变量设置
4. 查看Vercel构建日志

### API返回错误
1. 检查MongoDB Atlas连接
2. 验证环境变量配置
3. 查看Function日志
4. 测试数据库权限

### Python Functions失败
1. 检查`requirements-vercel.txt`
2. 验证Python代码语法
3. 查看Function超时设置
4. 检查依赖版本兼容性

### 数据不更新
1. 检查GitHub Actions状态
2. 验证定时任务配置
3. 测试手动抓取功能
4. 检查数据源可用性

## 📞 获取帮助

- **Vercel文档**: https://vercel.com/docs
- **MongoDB Atlas文档**: https://docs.atlas.mongodb.com/
- **项目仓库**: 查看README和Issues
- **日志查看**: Vercel Dashboard > Functions > Logs

---

✅ **部署成功标准**: 所有测试用例通过，核心功能正常运行，性能指标达标。