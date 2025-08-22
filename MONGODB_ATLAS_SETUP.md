# MongoDB Atlas 配置指南

## 第一步：注册 MongoDB Atlas 账户

1. 访问 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 点击 "Try Free" 或 "Start Free" 按钮
3. 使用邮箱注册账户或使用 Google/GitHub 账户登录
4. 完成邮箱验证

## 第二步：创建免费集群

1. 登录后，点击 "Build a Database" 或 "Create"
2. 选择 "M0 Sandbox" (免费层)
3. 选择云服务提供商和区域：
   - 推荐选择 **AWS** 或 **Google Cloud**
   - 区域选择离你最近的，如 **Asia Pacific (Singapore)** 或 **US East (N. Virginia)**
4. 集群名称可以保持默认或自定义（如：twpk-cluster）
5. 点击 "Create Cluster"

## 第三步：配置数据库访问

### 3.1 创建数据库用户
1. 在左侧菜单选择 "Database Access"
2. 点击 "Add New Database User"
3. 选择 "Password" 认证方式
4. 设置用户名和密码（请记住这些信息）：
   - 用户名：`twpkuser`
   - 密码：生成一个强密码（建议使用 "Autogenerate Secure Password"）
5. 在 "Database User Privileges" 选择 "Read and write to any database"
6. 点击 "Add User"

### 3.2 配置网络访问
1. 在左侧菜单选择 "Network Access"
2. 点击 "Add IP Address"
3. 选择 "Allow access from anywhere" (0.0.0.0/0)
   - 这是为了让 Railway 能够访问数据库
4. 点击 "Confirm"

## 第四步：获取连接字符串

1. 返回 "Database" 页面
2. 找到你的集群，点击 "Connect" 按钮
3. 选择 "Connect your application"
4. 选择 "Node.js" 和版本 "4.1 or later"
5. 复制连接字符串，格式类似：
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. 将 `<username>` 和 `<password>` 替换为你在步骤 3.1 中创建的用户名和密码

## 第五步：在 Railway 中配置环境变量

1. 在终端中运行：
   ```bash
   railway variables set DATABASE_URL="你的MongoDB Atlas连接字符串"
   ```

   例如：
   ```bash
   railway variables set DATABASE_URL="mongodb+srv://twpkuser:yourpassword@cluster0.xxxxx.mongodb.net/twpk?retryWrites=true&w=majority"
   ```

   **注意**：在连接字符串末尾添加数据库名称 `/twpk`

## 完成配置后的验证

配置完成后，我们将：
1. 修改 `server.js` 以优先使用 `DATABASE_URL`
2. 添加详细的连接状态检查
3. 重新部署应用
4. 验证数据库连接
5. 测试密钥管理系统功能

---

**重要提示**：
- 请妥善保管数据库用户名和密码
- MongoDB Atlas 免费层提供 512MB 存储空间，足够此项目使用
- 连接字符串中包含敏感信息，请勿在代码中硬编码

完成以上步骤后，请告知我，我将继续进行代码修改和部署。