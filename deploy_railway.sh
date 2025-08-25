#!/bin/bash
# Railway部署脚本
# 自动化部署台湾PK10项目到Railway平台

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

# 检查必要的命令
check_dependencies() {
    log_info "检查部署依赖..."
    
    # 检查Railway CLI
    if ! command -v railway &> /dev/null; then
        log_error "Railway CLI未安装，请先安装: npm install -g @railway/cli"
        exit 1
    fi
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装，请先安装Node.js"
        exit 1
    fi
    
    # 检查Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python3未安装，请先安装Python3"
        exit 1
    fi
    
    log_success "所有依赖检查通过"
}

# 检查项目文件
check_project_files() {
    log_info "检查项目文件..."
    
    required_files=(
        "package.json"
        "server.js"
        "auto_scheduler.py"
        "database_manager.py"
        "requirements.txt"
        "railway.toml"
        "nixpacks.toml"
        "Procfile"
        ".env.railway"
    )
    
    missing_files=()
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            missing_files+=("$file")
        fi
    done
    
    if [[ ${#missing_files[@]} -gt 0 ]]; then
        log_error "缺少必要文件:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        exit 1
    fi
    
    log_success "所有项目文件检查通过"
}

# 验证配置文件
validate_configs() {
    log_info "验证配置文件..."
    
    # 检查package.json
    if ! node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" 2>/dev/null; then
        log_error "package.json格式错误"
        exit 1
    fi
    
    # 检查Python语法
    if ! python3 -m py_compile auto_scheduler.py; then
        log_error "auto_scheduler.py语法错误"
        exit 1
    fi
    
    if ! python3 -m py_compile database_manager.py; then
        log_error "database_manager.py语法错误"
        exit 1
    fi
    
    log_success "配置文件验证通过"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    # 安装Node.js依赖
    log_info "安装Node.js依赖..."
    if ! npm install; then
        log_error "Node.js依赖安装失败"
        exit 1
    fi
    
    # 检查Python依赖（不在本地安装，Railway会处理）
    log_info "验证Python依赖配置..."
    if [[ ! -s "requirements.txt" ]]; then
        log_warning "requirements.txt为空或不存在"
    fi
    
    log_success "依赖安装完成"
}

# Railway登录检查
check_railway_auth() {
    log_info "检查Railway认证状态..."
    
    if ! railway whoami &> /dev/null; then
        log_warning "未登录Railway，请先登录"
        railway login
    fi
    
    log_success "Railway认证检查通过"
}

# 创建或连接Railway项目
setup_railway_project() {
    log_info "设置Railway项目..."
    
    # 检查是否已连接项目
    if [[ -f ".railway/project.json" ]]; then
        log_info "检测到现有Railway项目配置"
        project_id=$(cat .railway/project.json | grep -o '"projectId":"[^"]*' | cut -d'"' -f4)
        log_info "项目ID: $project_id"
    else
        log_info "创建新的Railway项目..."
        railway init
    fi
    
    log_success "Railway项目设置完成"
}

# 配置环境变量
setup_environment_variables() {
    log_info "配置环境变量..."
    
    if [[ -f ".env.railway" ]]; then
        log_info "发现Railway环境变量模板"
        log_warning "请手动在Railway Dashboard中配置以下环境变量:"
        echo ""
        echo "=== 必要的环境变量 ==="
        grep -E "^[A-Z_]+=" .env.railway | head -20
        echo ""
        echo "请访问 Railway Dashboard 配置这些变量"
        echo "配置完成后按回车继续..."
        read -r
    else
        log_warning "未找到.env.railway文件，请手动配置环境变量"
    fi
    
    log_success "环境变量配置完成"
}

# 部署到Railway
deploy_to_railway() {
    log_info "开始部署到Railway..."
    
    # 部署
    if railway up; then
        log_success "部署成功！"
    else
        log_error "部署失败"
        exit 1
    fi
    
    # 获取部署URL
    log_info "获取部署信息..."
    railway status
    
    log_success "Railway部署完成"
}

# 部署后验证
post_deploy_verification() {
    log_info "部署后验证..."
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    # 获取服务URL
    service_url=$(railway url 2>/dev/null || echo "")
    
    if [[ -n "$service_url" ]]; then
        log_info "服务URL: $service_url"
        
        # 测试健康检查
        log_info "测试健康检查端点..."
        if curl -f "$service_url/health" &> /dev/null; then
            log_success "健康检查通过"
        else
            log_warning "健康检查失败，请检查服务状态"
        fi
        
        # 测试API端点
        log_info "测试API端点..."
        if curl -f "$service_url/api/data/latest" &> /dev/null; then
            log_success "API端点正常"
        else
            log_warning "API端点测试失败"
        fi
    else
        log_warning "无法获取服务URL"
    fi
    
    log_success "部署验证完成"
}

# 显示部署信息
show_deployment_info() {
    log_info "部署信息汇总"
    echo ""
    echo "=== Railway部署完成 ==="
    echo "项目名称: 台湾PK10数据系统"
    echo "部署时间: $(date)"
    echo ""
    echo "=== 服务信息 ==="
    railway status
    echo ""
    echo "=== 下一步操作 ==="
    echo "1. 访问Railway Dashboard查看服务状态"
    echo "2. 检查日志: railway logs"
    echo "3. 监控服务: railway ps"
    echo "4. 配置域名（可选）"
    echo ""
    echo "=== 有用的命令 ==="
    echo "查看日志: railway logs"
    echo "查看状态: railway status"
    echo "重新部署: railway up"
    echo "打开控制台: railway open"
    echo ""
}

# 主函数
main() {
    echo "=== Railway部署脚本 ==="
    echo "台湾PK10数据系统自动化部署"
    echo ""
    
    # 执行部署步骤
    check_dependencies
    check_project_files
    validate_configs
    install_dependencies
    check_railway_auth
    setup_railway_project
    setup_environment_variables
    deploy_to_railway
    post_deploy_verification
    show_deployment_info
    
    log_success "部署流程完成！"
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查上面的错误信息"' ERR

# 运行主函数
main "$@"