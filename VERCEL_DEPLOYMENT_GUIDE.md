# Vercel 部署指南

## 快速部署步骤

### 1. 准备工作
确保所有代码已推送到 GitHub 仓库：
```bash
git status
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Vercel 部署

#### 方法一：通过 Vercel CLI（推荐）
1. 安装 Vercel CLI：
```bash
npm i -g vercel
```

2. 登录 Vercel：
```bash
vercel login
```

3. 在项目根目录执行部署：
```bash
vercel
```

4. 按照提示配置：
   - 选择或创建团队
   - 确认项目名称
   - 确认部署设置

#### 方法二：通过 Vercel 网站
1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录
3. 点击 "New Project"
4. 选择 GitHub 仓库：`bangjiong925-commits/myyz`
5. 配置项目设置：
   - Framework Preset: Other
   - Root Directory: ./
   - Build Command: (留空)
   - Output Directory: (留空)
   - Install Command: npm install

### 3. 环境变量配置（可选）
如果需要配置环境变量，在 Vercel 项目设置中添加：
- 进入项目 Dashboard
- 点击 "Settings" → "Environment Variables"
- 添加所需的环境变量

### 4. 自定义域名（可选）
1. 在 Vercel 项目设置中点击 "Domains"
2. 添加自定义域名
3. 按照提示配置 DNS 记录

## 部署后验证

### 检查 API 接口
部署完成后，验证以下接口是否正常工作：

1. **数据获取接口**：
```
https://your-project.vercel.app/api/taiwan-pk10-live
```

2. **数据更新接口**：
```
https://your-project.vercel.app/api/update-taiwan-pk10
```

3. **主页面**：
```
https://your-project.vercel.app/TWPK.html
```

### 检查自动更新
1. 查看 GitHub Actions 是否正常运行：
   - 进入 GitHub 仓库
   - 点击 "Actions" 标签
   - 检查 "Update Taiwan PK10 Data" 工作流状态

2. 验证定时任务：
   - 等待 10 分钟后检查数据是否自动更新
   - 查看 Actions 运行日志

## 常见问题

### 1. 部署失败
- 检查 `package.json` 中的依赖项
- 确保 Node.js 版本 >= 16.0.0
- 检查 `vercel.json` 配置文件

### 2. API 接口 500 错误
- 检查 Vercel 函数日志
- 验证 Puppeteer 和 Chromium 配置
- 确保函数超时设置足够（30-45秒）

### 3. 自动更新不工作
- 检查 GitHub Actions 权限
- 验证 Vercel 部署 URL 是否正确
- 查看 Actions 运行日志

## 监控和维护

### 1. 查看部署日志
- Vercel Dashboard → Functions → 查看函数日志
- GitHub Actions → 查看工作流运行历史

### 2. 性能监控
- Vercel Analytics（如果启用）
- 函数执行时间和成功率

### 3. 数据备份
- 定期备份 `taiwan_pk10_data.json`
- 监控数据更新频率和质量

## 部署完成后的 URL 结构

```
https://your-project.vercel.app/
├── /                          # 主页 (index.html)
├── /TWPK.html                 # 台湾PK10分析页面
├── /api/taiwan-pk10-live      # 实时数据API
├── /api/update-taiwan-pk10    # 数据更新API
└── /api/taiwan-pk10-data      # 历史数据API
```

---

**注意**：首次部署可能需要几分钟时间，请耐心等待。部署完成后，Vercel 会提供一个唯一的 URL 供访问。