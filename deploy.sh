#!/bin/bash

# 台湾PK10项目 - Vercel部署脚本
# 使用方法: ./deploy.sh [环境]
# 环境选项: dev (开发环境) 或 prod (生产环境，默认)

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 命令未找到，请先安装 $1"
        exit 1
    fi
}

# 检查文件是否存在
check_file() {
    if [ ! -f "$1" ]; then
        log_error "文件 $1 不存在"
        exit 1
    fi
}

# 检查环境变量
check_env_var() {
    if [ -z "${!1}" ]; then
        log_warning "环境变量 $1 未设置"
        return 1
    fi
    return 0
}

# 主函数
main() {
    local env=${1:-prod}
    
    log_info "开始部署台湾PK10项目到Vercel ($env 环境)"
    
    # 检查必要的命令
    log_info "检查必要的命令..."
    check_command "node"
    check_command "npm"
    check_command "git"
    
    # 检查Vercel CLI
    if ! command -v vercel &> /dev/null; then
        log_warning "Vercel CLI 未安装，正在安装..."
        npm install -g vercel
    fi
    
    # 检查必要的文件
    log_info "检查项目文件..."
    check_file "package.json"
    check_file "vercel.json"
    check_file "requirements-vercel.txt"
    check_file "api/scheduler.py"
    
    # 检查Git状态
    log_info "检查Git状态..."
    if [ -n "$(git status --porcelain)" ]; then
        log_warning "工作目录有未提交的更改"
        read -p "是否继续部署？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "部署已取消"
            exit 0
        fi
    fi
    
    # 安装依赖
    log_info "安装Node.js依赖..."
    npm install
    
    # 运行代码检查
    log_info "运行代码检查..."
    if npm run lint &> /dev/null; then
        log_success "代码检查通过"
    else
        log_warning "代码检查有警告，但继续部署"
    fi
    
    # 运行测试（如果存在）
    if npm run test &> /dev/null; then
        log_info "运行测试..."
        npm run test
        log_success "测试通过"
    else
        log_info "跳过测试（未配置测试脚本）"
    fi
    
    # 检查环境变量配置
    log_info "检查环境变量配置..."
    if [ -f ".env.vercel" ]; then
        log_success "找到Vercel环境变量模板"
        log_info "请确保在Vercel Dashboard中配置了以下环境变量："
        echo "  - MONGO_URL (MongoDB Atlas连接字符串)"
        echo "  - DATABASE_URL (备用数据库连接)"
        echo "  - DB_NAME (数据库名称)"
        echo "  - NODE_ENV (环境类型)"
        echo "  - TZ (时区设置)"
    else
        log_warning "未找到.env.vercel文件，请手动配置环境变量"
    fi
    
    # 登录Vercel（如果需要）
    log_info "检查Vercel登录状态..."
    if ! vercel whoami &> /dev/null; then
        log_info "需要登录Vercel..."
        vercel login
    else
        log_success "已登录Vercel: $(vercel whoami)"
    fi
    
    # 部署到Vercel
    log_info "开始部署到Vercel..."
    if [ "$env" = "prod" ]; then
        vercel --prod
    else
        vercel
    fi
    
    # 获取部署URL
    local deployment_url=$(vercel ls | grep "$(basename $(pwd))" | head -1 | awk '{print $2}')
    
    if [ -n "$deployment_url" ]; then
        log_success "部署完成！"
        log_info "部署URL: https://$deployment_url"
        
        # 运行部署后测试
        log_info "运行部署后测试..."
        test_deployment "https://$deployment_url"
    else
        log_error "无法获取部署URL"
        exit 1
    fi
}

# 部署后测试函数
test_deployment() {
    local base_url=$1
    local test_passed=0
    local test_total=0
    
    log_info "开始测试部署的应用..."
    
    # 测试健康检查端点
    test_total=$((test_total + 1))
    log_info "测试健康检查端点..."
    if curl -s -f "$base_url/health" > /dev/null; then
        log_success "✓ 健康检查端点正常"
        test_passed=$((test_passed + 1))
    else
        log_error "✗ 健康检查端点失败"
    fi
    
    # 测试最新数据端点
    test_total=$((test_total + 1))
    log_info "测试最新数据端点..."
    if curl -s -f "$base_url/latest-data" > /dev/null; then
        log_success "✓ 最新数据端点正常"
        test_passed=$((test_passed + 1))
    else
        log_error "✗ 最新数据端点失败"
    fi
    
    # 测试历史数据端点
    test_total=$((test_total + 1))
    log_info "测试历史数据端点..."
    if curl -s -f "$base_url/historical-data" > /dev/null; then
        log_success "✓ 历史数据端点正常"
        test_passed=$((test_passed + 1))
    else
        log_error "✗ 历史数据端点失败"
    fi
    
    # 测试统计端点
    test_total=$((test_total + 1))
    log_info "测试统计端点..."
    if curl -s -f "$base_url/stats" > /dev/null; then
        log_success "✓ 统计端点正常"
        test_passed=$((test_passed + 1))
    else
        log_error "✗ 统计端点失败"
    fi
    
    # 测试Python抓取器健康检查
    test_total=$((test_total + 1))
    log_info "测试Python抓取器健康检查..."
    if curl -s -f "$base_url/scheduler?action=health" > /dev/null; then
        log_success "✓ Python抓取器健康检查正常"
        test_passed=$((test_passed + 1))
    else
        log_error "✗ Python抓取器健康检查失败"
    fi
    
    # 测试主页
    test_total=$((test_total + 1))
    log_info "测试主页..."
    if curl -s -f "$base_url/" > /dev/null; then
        log_success "✓ 主页正常"
        test_passed=$((test_passed + 1))
    else
        log_error "✗ 主页失败"
    fi
    
    # 输出测试结果
    log_info "测试完成: $test_passed/$test_total 通过"
    
    if [ $test_passed -eq $test_total ]; then
        log_success "🎉 所有测试通过！应用部署成功！"
        
        # 显示有用的链接
        echo
        log_info "有用的链接："
        echo "  🌐 应用主页: $base_url/"
        echo "  📊 数据展示: $base_url/index.html"
        echo "  🔑 密钥管理: $base_url/key-management.html"
        echo "  ❤️  健康检查: $base_url/health"
        echo "  📈 数据统计: $base_url/stats"
        echo "  🐍 抓取器状态: $base_url/scheduler?action=health"
        echo "  🔄 触发抓取: $base_url/scheduler?action=scrape"
        echo
        
        # 显示下一步操作
        log_info "下一步操作："
        echo "  1. 设置定时任务触发数据抓取"
        echo "  2. 配置监控和告警"
        echo "  3. 测试数据抓取功能"
        echo "  4. 查看Vercel Dashboard监控面板"
        echo
        
    elif [ $test_passed -gt 0 ]; then
        log_warning "⚠️  部分测试失败，请检查应用配置"
        return 1
    else
        log_error "❌ 所有测试失败，部署可能有问题"
        return 1
    fi
}

# 显示帮助信息
show_help() {
    echo "台湾PK10项目 - Vercel部署脚本"
    echo
    echo "使用方法:"
    echo "  $0 [环境]                部署到指定环境"
    echo "  $0 --help               显示此帮助信息"
    echo "  $0 --test <URL>         测试已部署的应用"
    echo
    echo "环境选项:"
    echo "  dev                     部署到开发环境"
    echo "  prod                    部署到生产环境（默认）"
    echo
    echo "示例:"
    echo "  $0                      # 部署到生产环境"
    echo "  $0 dev                  # 部署到开发环境"
    echo "  $0 --test https://your-app.vercel.app  # 测试应用"
    echo
}

# 处理命令行参数
case "$1" in
    --help|-h)
        show_help
        exit 0
        ;;
    --test)
        if [ -z "$2" ]; then
            log_error "请提供要测试的URL"
            exit 1
        fi
        test_deployment "$2"
        exit $?
        ;;
    dev|prod|"")
        main "$1"
        ;;
    *)
        log_error "未知参数: $1"
        show_help
        exit 1
        ;;
esac