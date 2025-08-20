# 台湾PK10自动数据更新配置指南

## 概述

本项目已配置自动化数据更新系统，通过GitHub Actions定时调用Vercel部署的API接口来获取最新的台湾PK10开奖数据。

## 配置步骤

### 1. 设置GitHub Secrets

在GitHub仓库中设置以下Secrets：

1. 进入GitHub仓库 → Settings → Secrets and variables → Actions
2. 添加以下Repository secrets：

```
VERCEL_DOMAIN=your-vercel-domain.vercel.app
UPDATE_TOKEN=your-secure-token-here
```

### 2. 设置Vercel环境变量

在Vercel项目设置中添加环境变量：

```
UPDATE_TOKEN=your-secure-token-here
```

**注意：** `UPDATE_TOKEN` 在GitHub和Vercel中必须保持一致。

### 3. API接口说明

#### `/api/taiwan-pk10-live`
- **功能：** 实时抓取台湾PK10开奖数据
- **方法：** GET
- **返回：** JSON格式的最新开奖数据

#### `/api/update-taiwan-pk10`
- **功能：** 定时更新数据的触发接口
- **方法：** GET
- **认证：** 需要提供 `UPDATE_TOKEN`
- **参数：** `?token=your-token` 或 Header `Authorization: Bearer your-token`

### 4. 定时任务配置

当前配置为每10分钟自动更新一次数据，可以通过修改 `.github/workflows/update-data.yml` 文件中的 cron 表达式来调整频率：

```yaml
schedule:
  # 每10分钟运行一次
  - cron: '*/10 * * * *'
  
  # 其他示例：
  # 每5分钟：'*/5 * * * *'
  # 每小时：'0 * * * *'
  # 每天上午9点：'0 9 * * *'
```

### 5. 手动触发更新

可以通过以下方式手动触发数据更新：

1. **GitHub Actions：** 在Actions页面手动运行workflow
2. **API调用：** 直接访问更新API接口
3. **本地测试：** 使用curl命令测试

```bash
curl -X GET "https://your-domain.vercel.app/api/update-taiwan-pk10?token=your-token"
```

## 监控和日志

### GitHub Actions日志
- 在GitHub仓库的Actions页面查看定时任务执行状态
- 每次执行都会记录时间戳和状态信息

### Vercel函数日志
- 在Vercel控制台的Functions页面查看API调用日志
- 可以监控API响应时间和错误信息

## 故障排除

### 常见问题

1. **401 Unauthorized错误**
   - 检查UPDATE_TOKEN是否正确配置
   - 确认GitHub Secrets和Vercel环境变量中的token一致

2. **定时任务不执行**
   - 检查GitHub Actions是否启用
   - 确认cron表达式格式正确
   - 查看Actions页面的错误日志

3. **数据抓取失败**
   - 检查目标网站是否可访问
   - 查看Vercel函数日志中的错误信息
   - 确认网站结构是否发生变化

### 调试步骤

1. 手动测试API接口
2. 检查GitHub Actions执行日志
3. 查看Vercel函数运行日志
4. 验证环境变量配置

## 安全注意事项

1. **Token安全：** 使用强随机字符串作为UPDATE_TOKEN
2. **访问控制：** 只允许授权的服务调用更新接口
3. **日志监控：** 定期检查访问日志，发现异常访问
4. **Token轮换：** 定期更换UPDATE_TOKEN

## 扩展功能

### 数据库集成
可以在 `update-taiwan-pk10.js` 中添加数据库连接，将历史数据持久化存储：

```javascript
// 示例：MongoDB集成
const { MongoClient } = require('mongodb');

async function saveToDatabase(data) {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('lottery');
  await db.collection('taiwan_pk10').insertOne(data);
  await client.close();
}
```

### 通知系统
可以添加邮件或消息通知功能，在数据更新失败时发送警报。

### 数据验证
可以添加数据完整性检查，确保抓取的数据格式正确。