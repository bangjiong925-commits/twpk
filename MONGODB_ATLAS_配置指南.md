# MongoDB Atlas 配置指南

## 概述

MongoDB Atlas是MongoDB官方提供的云数据库服务，为台湾PK10项目提供可靠的数据存储解决方案。本指南将详细介绍如何设置和配置MongoDB Atlas。

## 为什么选择MongoDB Atlas？

### 优势

✅ **免费计划**：512MB存储空间，足够项目使用  
✅ **全球部署**：多个数据中心，低延迟访问  
✅ **自动备份**：每日自动备份，数据安全有保障  
✅ **高可用性**：99.95%可用性保证  
✅ **易于扩展**：随时升级配置  
✅ **安全性**：企业级安全防护  
✅ **监控面板**：实时性能监控和告警  
✅ **无需维护**：自动更新和维护  

### 与本地MongoDB对比

| 特性 | 本地MongoDB | MongoDB Atlas |
|------|-------------|---------------|
| 部署复杂度 | 需要手动安装配置 | 一键创建 |
| 维护成本 | 需要手动维护 | 自动维护 |
| 备份恢复 | 需要手动备份 | 自动备份 |
| 扩展性 | 需要手动扩展 | 一键扩展 |
| 安全性 | 需要手动配置 | 企业级安全 |
| 监控 | 需要额外工具 | 内置监控 |
| 成本 | 服务器成本 | 免费计划可用 |

## 注册和设置

### 步骤1：创建MongoDB Atlas账户

1. 访问 [MongoDB Atlas官网](https://www.mongodb.com/cloud/atlas)
2. 点击 "Try Free" 按钮
3. 填写注册信息：
   - 邮箱地址
   - 密码（至少8位，包含大小写字母和数字）
   - 姓名
4. 验证邮箱地址
5. 完成账户设置

### 步骤2：创建组织和项目

1. 登录Atlas Dashboard
2. 创建新组织（可选）：
   - 组织名称：`Taiwan PK10 Project`
   - 选择免费计划
3. 创建新项目：
   - 项目名称：`taiwan-pk10-data`
   - 添加项目成员（可选）

### 步骤3：创建数据库集群

1. 在项目Dashboard中点击 "Build a Database"
2. 选择部署类型：
   - **Shared**（免费）：选择 "M0 Sandbox"
   - 存储：512MB
   - RAM：共享
3. 选择云服务商和区域：
   - **推荐**：AWS - Singapore (ap-southeast-1)
   - **备选**：Google Cloud - Taiwan (asia-east1)
   - **备选**：Azure - East Asia
4. 集群配置：
   - 集群名称：`taiwan-pk10-cluster`
   - MongoDB版本：7.0（最新稳定版）
   - 备份：启用（免费计划包含）
5. 点击 "Create Cluster"

### 步骤4：配置网络访问

1. 在左侧菜单选择 "Network Access"
2. 点击 "Add IP Address"
3. 配置访问规则：
   - **选项1**：允许所有IP访问
     - IP地址：`0.0.0.0/0`
     - 描述：`Allow access from anywhere`
   - **选项2**：仅允许特定IP（更安全）
     - 添加您的当前IP
     - 添加Vercel的IP范围（如果知道）
4. 点击 "Confirm"

**注意**：生产环境建议限制IP访问范围以提高安全性。

### 步骤5：创建数据库用户

1. 在左侧菜单选择 "Database Access"
2. 点击 "Add New Database User"
3. 配置用户信息：
   - **认证方式**：Password
   - **用户名**：`taiwan_pk10_user`
   - **密码**：生成强密码（建议使用自动生成）
   - **数据库用户权限**：
     - 选择 "Built-in Role"
     - 角色：`readWrite`
     - 数据库：`taiwan_pk10`
4. 点击 "Add User"

**重要**：请妥善保存用户名和密码，后续配置需要使用。

### 步骤6：获取连接字符串

1. 返回 "Clusters" 页面
2. 点击集群的 "Connect" 按钮
3. 选择连接方式："Connect your application"
4. 选择驱动程序：
   - Driver：`Node.js`
   - Version：`4.1 or later`
5. 复制连接字符串：

```
mongodb+srv://<username>:<password>@taiwan-pk10-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

6. 替换占位符：
   - `<username>`：替换为实际用户名
   - `<password>`：替换为实际密码
   - 添加数据库名：在 `mongodb.net/` 后添加 `taiwan_pk10`

最终连接字符串示例：
```
mongodb+srv://taiwan_pk10_user:your_password@taiwan-pk10-cluster.xxxxx.mongodb.net/taiwan_pk10?retryWrites=true&w=majority
```

## 数据迁移

### 从本地MongoDB迁移到Atlas

#### 方法1：使用MongoDB Compass（推荐）

1. **下载MongoDB Compass**：
   - 访问 [MongoDB Compass官网](https://www.mongodb.com/products/compass)
   - 下载并安装

2. **连接本地数据库**：
   - 连接字符串：`mongodb://localhost:27017`
   - 选择数据库：`taiwan_pk10_test`

3. **导出数据**：
   - 选择集合
   - 点击 "Export Collection"
   - 格式：JSON
   - 保存到本地文件

4. **连接Atlas数据库**：
   - 使用Atlas连接字符串连接
   - 创建数据库：`taiwan_pk10`

5. **导入数据**：
   - 选择目标集合
   - 点击 "Import Data"
   - 选择之前导出的JSON文件
   - 开始导入

#### 方法2：使用命令行工具

1. **导出本地数据**：

```bash
# 导出整个数据库
mongodump --host localhost:27017 --db taiwan_pk10_test --out ./backup

# 或导出特定集合
mongodump --host localhost:27017 --db taiwan_pk10_test --collection taiwan_pk10_data_20241225 --out ./backup
```

2. **导入到Atlas**：

```bash
# 导入整个数据库
mongorestore --uri "mongodb+srv://username:password@cluster.mongodb.net/taiwan_pk10" ./backup/taiwan_pk10_test

# 或导入特定集合
mongorestore --uri "mongodb+srv://username:password@cluster.mongodb.net/taiwan_pk10" --collection taiwan_pk10_data_20241225 ./backup/taiwan_pk10_test/taiwan_pk10_data_20241225.bson
```

#### 方法3：使用Atlas Data Import工具

1. 在Atlas Dashboard中选择集群
2. 点击 "Collections" 标签
3. 点击 "Add My Own Data"
4. 创建数据库和集合
5. 使用 "Insert Document" 或 "Import" 功能

### 数据验证

迁移完成后，验证数据完整性：

```javascript
// 连接Atlas数据库
const { MongoClient } = require('mongodb');

async function validateData() {
  const client = new MongoClient('your_atlas_connection_string');
  
  try {
    await client.connect();
    const db = client.db('taiwan_pk10');
    
    // 检查集合列表
    const collections = await db.listCollections().toArray();
    console.log('集合列表:', collections.map(c => c.name));
    
    // 检查数据量
    for (const collection of collections) {
      const count = await db.collection(collection.name).countDocuments();
      console.log(`${collection.name}: ${count} 条记录`);
    }
    
    // 检查最新数据
    const latestData = await db.collection('taiwan_pk10_data_20241225')
      .findOne({}, { sort: { issue: -1 } });
    console.log('最新数据:', latestData);
    
  } finally {
    await client.close();
  }
}

validateData();
```

## 环境变量配置

### 更新项目配置

1. **更新 `.env` 文件**：

```bash
# 原本地配置
# MONGO_URL=mongodb://localhost:27017/taiwan_pk10_test

# 新Atlas配置
MONGO_URL=mongodb+srv://taiwan_pk10_user:your_password@taiwan-pk10-cluster.xxxxx.mongodb.net/taiwan_pk10?retryWrites=true&w=majority
DATABASE_URL=mongodb+srv://taiwan_pk10_user:your_password@taiwan-pk10-cluster.xxxxx.mongodb.net/taiwan_pk10?retryWrites=true&w=majority
DB_NAME=taiwan_pk10
```

2. **更新Vercel环境变量**：

在Vercel Dashboard中设置：
- `MONGO_URL`：Atlas连接字符串
- `DATABASE_URL`：Atlas连接字符串（备用）
- `DB_NAME`：`taiwan_pk10`

3. **测试连接**：

```bash
# 本地测试
node -e "require('./utils/database_manager.js').connect().then(() => console.log('连接成功')).catch(console.error)"
```

## 数据库设计优化

### 索引创建

为提高查询性能，创建适当的索引：

```javascript
// 在Atlas Dashboard的Collections页面，选择集合，点击"Indexes"标签

// 创建索引的MongoDB命令
db.taiwan_pk10_data_20241225.createIndex({ "issue": -1 })  // 期号索引
db.taiwan_pk10_data_20241225.createIndex({ "time": -1 })   // 时间索引
db.taiwan_pk10_data_20241225.createIndex({ "issue": -1, "time": -1 })  // 复合索引
```

### 集合分片策略

继续使用现有的分文件存储策略：

```javascript
// 集合命名规则
// taiwan_pk10_data_YYYYMMDD  // 按日期分集合
// taiwan_pk10_data_20241225  // 示例

// 每个集合最多1000条记录
// 超过后自动创建新集合
```

### 数据保留策略

```javascript
// 设置TTL索引（可选）
db.taiwan_pk10_data_20241225.createIndex(
  { "createdAt": 1 },
  { expireAfterSeconds: 31536000 }  // 1年后自动删除
)
```

## 监控和维护

### Atlas监控面板

1. **性能监控**：
   - CPU使用率
   - 内存使用率
   - 磁盘I/O
   - 网络流量

2. **查询分析**：
   - 慢查询检测
   - 查询性能优化建议
   - 索引使用情况

3. **告警设置**：
   - 连接数过高
   - 磁盘空间不足
   - 查询性能下降
   - 错误率上升

### 定期维护任务

1. **数据备份验证**：
   - 检查自动备份状态
   - 测试数据恢复流程

2. **性能优化**：
   - 分析慢查询
   - 优化索引策略
   - 清理过期数据

3. **安全检查**：
   - 审查访问权限
   - 更新密码
   - 检查网络访问规则

## 故障排除

### 常见问题

#### 1. 连接超时

**问题**：`MongoTimeoutError: Server selection timed out`

**解决方案**：
- 检查网络访问设置（IP白名单）
- 验证连接字符串格式
- 确认用户名密码正确
- 检查集群状态

#### 2. 认证失败

**问题**：`MongoAuthenticationError: Authentication failed`

**解决方案**：
- 验证用户名密码
- 检查用户权限设置
- 确认数据库名称正确
- 重新创建数据库用户

#### 3. 连接数过多

**问题**：`MongoError: Too many connections`

**解决方案**：
- 使用连接池
- 及时关闭连接
- 优化应用程序逻辑
- 考虑升级集群配置

#### 4. 查询性能慢

**问题**：查询响应时间过长

**解决方案**：
- 创建适当索引
- 优化查询语句
- 使用聚合管道
- 限制返回字段

### 调试工具

1. **MongoDB Compass**：
   - 可视化数据浏览
   - 查询性能分析
   - 索引管理
   - 数据导入导出

2. **Atlas CLI**：
   - 命令行管理工具
   - 自动化部署
   - 监控和告警

3. **日志分析**：
   - 应用程序日志
   - Atlas操作日志
   - 慢查询日志

## 成本优化

### 免费计划限制

- **存储空间**：512MB
- **连接数**：500个并发连接
- **备份**：2天保留期
- **监控**：基础监控指标

### 优化建议

1. **数据压缩**：
   - 使用简短字段名
   - 删除不必要字段
   - 压缩存储格式

2. **查询优化**：
   - 使用投影限制返回字段
   - 合理使用分页
   - 缓存常用查询结果

3. **连接管理**：
   - 使用连接池
   - 及时关闭连接
   - 避免长时间连接

### 升级考虑

当免费计划不够用时，考虑升级到：

- **M2**：$9/月，2GB存储
- **M5**：$25/月，5GB存储
- **M10**：$57/月，10GB存储

## 安全最佳实践

### 1. 访问控制

- 使用强密码
- 定期轮换密码
- 限制IP访问范围
- 启用双因素认证

### 2. 数据加密

- 传输加密（TLS/SSL）
- 静态数据加密
- 字段级加密（敏感数据）

### 3. 审计日志

- 启用操作审计
- 监控异常访问
- 定期审查日志

### 4. 备份安全

- 加密备份数据
- 异地备份存储
- 定期测试恢复

## 总结

MongoDB Atlas为台湾PK10项目提供了：

✅ **可靠的云数据库服务**  
✅ **免费计划足够项目使用**  
✅ **自动备份和高可用性**  
✅ **企业级安全防护**  
✅ **实时监控和告警**  
✅ **易于扩展和维护**  

通过本指南，您可以：

1. 快速设置MongoDB Atlas集群
2. 安全地迁移现有数据
3. 优化数据库性能
4. 监控和维护数据库
5. 解决常见问题

**立即开始使用MongoDB Atlas，享受专业的云数据库服务！** 🚀

---

**下一步**：完成Atlas设置后，请参考 `VERCEL_DEPLOYMENT.md` 继续配置Vercel部署。