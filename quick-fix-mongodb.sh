#!/bin/bash

# TWPK MongoDB 快速修复脚本
# 解决 ECONNREFUSED 错误

echo "🔧 TWPK MongoDB 快速修复工具"
echo "================================"
echo ""
echo "ECONNREFUSED 错误说明:"
echo "这个错误表示应用无法连接到 MongoDB 数据库。"
echo "原因: 本地没有安装 MongoDB 服务。"
echo ""
echo "🚀 正在为您安装本地 MongoDB..."
echo ""

# 检查是否已安装 Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ 未检测到 Homebrew，请先安装 Homebrew:"
    echo "/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

echo "✅ 检测到 Homebrew"
echo ""

# 添加 MongoDB tap
echo "📦 添加 MongoDB 仓库..."
brew tap mongodb/brew

if [ $? -eq 0 ]; then
    echo "✅ MongoDB 仓库添加成功"
else
    echo "❌ MongoDB 仓库添加失败"
    exit 1
fi

echo ""

# 安装 MongoDB Community Edition
echo "⬇️ 安装 MongoDB Community Edition..."
brew install mongodb-community

if [ $? -eq 0 ]; then
    echo "✅ MongoDB 安装成功"
else
    echo "❌ MongoDB 安装失败"
    exit 1
fi

echo ""

# 启动 MongoDB 服务
echo "🚀 启动 MongoDB 服务..."
brew services start mongodb/brew/mongodb-community

if [ $? -eq 0 ]; then
    echo "✅ MongoDB 服务启动成功"
else
    echo "❌ MongoDB 服务启动失败"
    exit 1
fi

echo ""

# 配置环境变量
echo "⚙️ 配置数据库连接..."
echo "DATABASE_URL=mongodb://localhost:27017/twpk" > .env

echo "✅ 数据库连接配置完成"
echo ""

echo "🎉 修复完成！"
echo "================================"
echo "现在可以运行以下命令启动应用:"
echo "npm start"
echo ""
echo "如果仍有问题，请检查:"
echo "1. MongoDB 服务是否正在运行: brew services list | grep mongodb"
echo "2. 端口 27017 是否被占用: lsof -i :27017"
echo "3. 查看 MongoDB 日志: brew services info mongodb-community"
echo ""