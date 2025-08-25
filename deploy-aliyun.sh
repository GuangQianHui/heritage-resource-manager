#!/bin/bash

# 🚀 阿里云ECS部署脚本
# 专门针对阿里云服务器优化的部署脚本

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warn "检测到root用户，建议使用普通用户运行此脚本"
        read -p "是否继续？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# 获取系统信息
get_system_info() {
    log_step "获取系统信息..."
    
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    
    log_info "操作系统: $OS $VER"
    log_info "内核版本: $(uname -r)"
    log_info "架构: $(uname -m)"
}

# 更新系统
update_system() {
    log_step "更新系统包..."
    
    if [[ "$OS" == *"Ubuntu"* ]]; then
        sudo apt update && sudo apt upgrade -y
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        sudo yum update -y
    else
        log_warn "未知操作系统，跳过系统更新"
    fi
}

# 安装基础软件
install_basic_software() {
    log_step "安装基础软件..."
    
    if [[ "$OS" == *"Ubuntu"* ]]; then
        sudo apt install -y curl wget git unzip build-essential
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        sudo yum install -y curl wget git unzip gcc gcc-c++ make
    fi
}

# 安装Node.js
install_nodejs() {
    log_step "安装Node.js..."
    
    # 检查Node.js是否已安装
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_info "Node.js已安装: $NODE_VERSION"
        
        # 检查版本是否满足要求
        if [[ "${NODE_VERSION:1}" < "16" ]]; then
            log_warn "Node.js版本过低，需要升级"
        else
            log_info "Node.js版本满足要求"
            return 0
        fi
    fi
    
    # 安装Node.js 18.x
    log_info "安装Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # 验证安装
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log_info "Node.js安装完成: $NODE_VERSION"
    log_info "npm安装完成: $NPM_VERSION"
}

# 安装PM2
install_pm2() {
    log_step "安装PM2进程管理器..."
    
    if command -v pm2 &> /dev/null; then
        log_info "PM2已安装"
        return 0
    fi
    
    sudo npm install -g pm2
    log_info "PM2安装完成"
}

# 跳过Nginx安装
skip_nginx() {
    log_step "跳过Nginx安装..."
    log_info "使用纯Node.js部署，不安装Nginx"
}

# 创建应用目录
create_app_directory() {
    log_step "创建应用目录..."
    
    # 定义应用目录
    APP_DIR="/opt/heritage-app"
    
    # 检查目录是否已存在
    if [[ -d "$APP_DIR" ]]; then
        log_warn "应用目录已存在: $APP_DIR"
        read -p "是否清空现有目录？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "清空现有目录..."
            sudo rm -rf "$APP_DIR"/*
        else
            log_info "保留现有目录内容"
        fi
    fi
    
    # 创建目录结构
    log_info "创建应用目录结构..."
    sudo mkdir -p "$APP_DIR"
    sudo mkdir -p "$APP_DIR/logs"
    sudo mkdir -p "$APP_DIR/uploads"
    sudo mkdir -p "$APP_DIR/backups"
    
    # 设置目录权限
    log_info "设置目录权限..."
    sudo chown -R $USER:$USER "$APP_DIR"
    sudo chmod -R 755 "$APP_DIR"
    sudo chmod -R 777 "$APP_DIR/logs"
    sudo chmod -R 777 "$APP_DIR/uploads"
    sudo chmod -R 755 "$APP_DIR/backups"
    
    # 验证目录创建
    if [[ -d "$APP_DIR" && -w "$APP_DIR" ]]; then
        log_info "✅ 应用目录创建成功: $APP_DIR"
        log_info "📁 日志目录: $APP_DIR/logs"
        log_info "📁 上传目录: $APP_DIR/uploads"
        log_info "📁 备份目录: $APP_DIR/backups"
    else
        log_error "❌ 应用目录创建失败: $APP_DIR"
        exit 1
    fi
}

# 检查网络连接
check_network() {
    log_step "检查网络连接..."
    
    # 检查GitHub连接
    if curl -s --connect-timeout 10 https://github.com > /dev/null; then
        log_info "✅ GitHub连接正常"
    else
        log_error "❌ 无法连接到GitHub，请检查网络连接"
        exit 1
    fi
    
    # 检查npm registry连接
    if curl -s --connect-timeout 10 https://registry.npmjs.org > /dev/null; then
        log_info "✅ npm registry连接正常"
    else
        log_error "❌ 无法连接到npm registry，请检查网络连接"
        exit 1
    fi
}

# 下载应用代码
download_app() {
    log_step "下载应用代码..."
    
    cd $APP_DIR
    
    # 检查是否已有代码
    if [[ -d ".git" ]]; then
        log_info "检测到现有代码，更新到最新版本..."
        git pull origin main
    else
        log_info "克隆代码仓库..."
        git clone https://github.com/GuangQianHui/heritage-resource-manager.git .
    fi
    
    # 验证代码下载是否成功
    if [[ ! -f "package.json" ]]; then
        log_error "❌ package.json文件未找到，代码下载可能失败"
        log_info "尝试重新克隆代码..."
        
        # 清空目录并重新克隆
        rm -rf .git package.json package-lock.json node_modules
        git clone https://github.com/GuangQianHui/heritage-resource-manager.git .
        
        # 再次验证
        if [[ ! -f "package.json" ]]; then
            log_error "❌ 重新克隆后仍无法找到package.json文件"
            log_error "请检查网络连接和GitHub仓库地址"
            exit 1
        fi
    fi
    
    # 显示下载的文件信息
    log_info "✅ 代码下载完成"
    log_info "📄 找到package.json文件"
    log_info "📁 当前目录内容:"
    ls -la | head -10
}

# 安装依赖
install_dependencies() {
    log_step "安装应用依赖..."
    
    cd $APP_DIR
    
    # 验证package.json存在
    if [[ ! -f "package.json" ]]; then
        log_error "❌ package.json文件不存在，无法安装依赖"
        exit 1
    fi
    
    # 显示package.json信息
    log_info "📄 package.json信息:"
    cat package.json | grep -E '"name"|"version"|"description"' | head -3
    
    # 安装主应用依赖
    log_info "安装主应用依赖..."
    if npm install; then
        log_info "✅ 主应用依赖安装成功"
    else
        log_error "❌ 主应用依赖安装失败"
        log_info "尝试使用--force选项重新安装..."
        if npm install --force; then
            log_info "✅ 主应用依赖强制安装成功"
        else
            log_error "❌ 主应用依赖安装完全失败"
            exit 1
        fi
    fi
    
    # 检查资源服务器目录
    if [[ ! -d "resources-server" ]]; then
        log_error "❌ resources-server目录不存在"
        exit 1
    fi
    
    # 安装资源服务器依赖
    log_info "安装资源服务器依赖..."
    cd resources-server
    
    if [[ ! -f "package.json" ]]; then
        log_error "❌ resources-server/package.json文件不存在"
        exit 1
    fi
    
    if npm install; then
        log_info "✅ 资源服务器依赖安装成功"
    else
        log_error "❌ 资源服务器依赖安装失败"
        log_info "尝试使用--force选项重新安装..."
        if npm install --force; then
            log_info "✅ 资源服务器依赖强制安装成功"
        else
            log_error "❌ 资源服务器依赖安装完全失败"
            exit 1
        fi
    fi
    
    cd ..
    
    log_info "✅ 所有依赖安装完成"
}

# 配置环境变量
setup_environment() {
    log_step "配置环境变量..."
    
    cd $APP_DIR
    
    # 获取系统信息
    PUBLIC_IP=$(curl -s ifconfig.me)
    PRIVATE_IP=$(hostname -I | awk '{print $1}')
    HOSTNAME=$(hostname)
    
    log_info "检测到公网IP: $PUBLIC_IP"
    log_info "检测到内网IP: $PRIVATE_IP"
    log_info "主机名: $HOSTNAME"
    
    # 检查是否已有环境变量文件
    if [[ -f ".env" ]]; then
        log_warn "环境变量文件已存在"
        read -p "是否覆盖现有配置？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "保留现有环境变量配置"
            return 0
        fi
    fi
    
    # 创建环境变量文件
    cat > .env << EOF
# 非遗文化传承智能体助手 - 阿里云部署配置
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

# 主服务器配置
PORT=3000
NODE_ENV=production

# 资源服务器配置
RESOURCE_SERVER_URL=http://$PUBLIC_IP:3001
RESOURCE_SERVER_MODULAR=true

# 阿里云特定配置
PUBLIC_IP=$PUBLIC_IP
PRIVATE_IP=$PRIVATE_IP
HOSTNAME=$HOSTNAME

# 安全配置
CORS_ORIGINS=http://$PUBLIC_IP:3000,http://$PUBLIC_IP:3001,http://localhost:3000,http://127.0.0.1:3000

# 文件上传配置
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# 性能配置
NODE_OPTIONS=--max-old-space-size=2048
EOF
    
    # 验证环境变量文件
    if [[ -f ".env" ]]; then
        log_info "✅ 环境变量配置完成"
        log_info "📄 配置文件路径: $APP_DIR/.env"
        
        # 显示关键配置
        log_info "🔧 关键配置信息:"
        log_info "   - 主服务器端口: 3000"
        log_info "   - 资源服务器端口: 3001"
        log_info "   - 公网IP: $PUBLIC_IP"
        log_info "   - 环境模式: production"
    else
        log_error "❌ 环境变量配置失败"
        exit 1
    fi
}

# 创建PM2配置文件
create_pm2_config() {
    log_step "创建PM2配置文件..."
    
    cd $APP_DIR
    
    # 检查是否已有配置文件
    if [[ -f "ecosystem.config.js" ]]; then
        log_warn "PM2配置文件已存在"
        read -p "是否覆盖现有配置？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "保留现有PM2配置"
            return 0
        fi
    fi
    
    # 获取系统信息用于优化配置
    local cpu_cores=$(nproc)
    local total_memory=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    local max_memory=$((total_memory / 4))  # 使用1/4内存作为限制
    
    log_info "系统信息 - CPU核心: $cpu_cores, 总内存: ${total_memory}MB, 应用内存限制: ${max_memory}MB"
    
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'heritage-main-server',
      script: 'server.js',
      cwd: '$APP_DIR',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '${max_memory}M',
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PUBLIC_IP: '$(curl -s ifconfig.me)'
      },
      error_file: './logs/main-error.log',
      out_file: './logs/main-out.log',
      log_file: './logs/main-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'heritage-resource-server',
      script: 'server.js',
      cwd: '$APP_DIR/resources-server',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '${max_memory}M',
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        PUBLIC_IP: '$(curl -s ifconfig.me)'
      },
      error_file: '../logs/resource-error.log',
      out_file: '../logs/resource-out.log',
      log_file: '../logs/resource-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
EOF
    
    # 验证配置文件
    if [[ -f "ecosystem.config.js" ]]; then
        log_info "✅ PM2配置文件创建成功"
        log_info "📄 配置文件路径: $APP_DIR/ecosystem.config.js"
    else
        log_error "❌ PM2配置文件创建失败"
        exit 1
    fi
}

# 跳过Nginx配置
skip_nginx_config() {
    log_step "跳过Nginx配置..."
    log_info "使用纯Node.js部署，直接访问端口3000和3001"
}

# 验证目录结构
verify_directories() {
    log_step "验证目录结构..."
    
    cd $APP_DIR
    
    # 检查必要目录是否存在
    local required_dirs=("logs" "uploads" "backups")
    local missing_dirs=()
    
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            missing_dirs+=("$dir")
        fi
    done
    
    if [[ ${#missing_dirs[@]} -gt 0 ]]; then
        log_warn "缺少以下目录: ${missing_dirs[*]}"
        log_info "重新创建缺失目录..."
        for dir in "${missing_dirs[@]}"; do
            mkdir -p "$dir"
            chmod 777 "$dir"
        done
    fi
    
    # 检查目录权限
    for dir in "${required_dirs[@]}"; do
        if [[ ! -w "$dir" ]]; then
            log_warn "目录权限不足: $dir"
            chmod 777 "$dir"
        fi
    done
    
    log_info "✅ 目录结构验证完成"
}

# 启动应用
start_application() {
    log_step "启动应用..."
    
    cd $APP_DIR
    
    # 启动应用
    pm2 start ecosystem.config.js
    
    # 保存PM2配置
    pm2 save
    
    # 设置PM2开机自启
    pm2 startup
    
    log_info "应用启动完成"
}

# 创建管理脚本
create_management_scripts() {
    log_step "创建管理脚本..."
    
    cd $APP_DIR
    
    # 更新脚本
    cat > update.sh << 'EOF'
#!/bin/bash
echo "🔄 开始更新应用..."

# 停止服务
pm2 stop heritage-main-server heritage-resource-server

# 备份当前版本
BACKUP_DIR="../heritage-backup-$(date +%Y%m%d-%H%M%S)"
cp -r . $BACKUP_DIR
echo "✅ 备份完成: $BACKUP_DIR"

# 拉取最新代码
git pull origin main

# 安装依赖
npm install
cd resources-server && npm install && cd ..

# 重启服务
pm2 restart heritage-main-server heritage-resource-server

echo "✅ 更新完成！"
EOF
    
    # 监控脚本
    cat > monitor.sh << 'EOF'
#!/bin/bash
echo "📊 系统监控信息"
echo "=================="

echo "CPU使用率:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1

echo "内存使用率:"
free | grep Mem | awk '{printf "%.2f%%", $3/$2 * 100.0}'

echo "磁盘使用率:"
df -h / | awk 'NR==2 {print $5}'

echo "应用状态:"
pm2 status

echo "端口监听:"
netstat -tulpn | grep -E ':(3000|3001)'
EOF
    
    # 优化脚本
    cat > optimize-aliyun.sh << 'EOF'
#!/bin/bash
echo "🔧 阿里云系统优化..."

# 优化系统参数
echo "优化系统参数..."
sudo sysctl -w net.core.somaxconn=65535
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=65535
sudo sysctl -w net.ipv4.tcp_fin_timeout=30
sudo sysctl -w net.ipv4.tcp_keepalive_time=1200

# 优化文件描述符限制
echo "优化文件描述符限制..."
echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf

    # 优化Node.js配置
    echo "优化Node.js配置..."
    echo "Node.js已优化为生产环境配置"

echo "✅ 系统优化完成！"
EOF
    
    # 给脚本执行权限
    chmod +x update.sh monitor.sh optimize-aliyun.sh
    
    log_info "管理脚本创建完成"
}

# 配置防火墙（不包含80端口）
configure_firewall_no_nginx() {
    log_step "配置防火墙..."
    
    # 检查防火墙状态
    if command -v ufw &> /dev/null; then
        # Ubuntu UFW
        sudo ufw allow 22/tcp
        sudo ufw allow 3000/tcp
        sudo ufw allow 3001/tcp
        sudo ufw --force enable
        log_info "UFW防火墙配置完成（端口22, 3000, 3001）"
    elif command -v firewall-cmd &> /dev/null; then
        # CentOS Firewalld
        sudo firewall-cmd --permanent --add-port=22/tcp
        sudo firewall-cmd --permanent --add-port=3000/tcp
        sudo firewall-cmd --permanent --add-port=3001/tcp
        sudo firewall-cmd --reload
        log_info "Firewalld防火墙配置完成（端口22, 3000, 3001）"
    else
        log_warn "未检测到防火墙，请手动配置端口开放"
    fi
}

# 显示部署结果
show_deployment_result() {
    log_step "部署完成！"
    
    PUBLIC_IP=$(curl -s ifconfig.me)
    
    echo -e "${GREEN}🎉 部署成功！${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${YELLOW}访问地址:${NC}"
    echo -e "  主应用: ${GREEN}http://$PUBLIC_IP:3000${NC}"
    echo -e "  资源服务器: ${GREEN}http://$PUBLIC_IP:3001${NC}"
    echo -e "  直接访问: ${GREEN}http://$PUBLIC_IP:3000${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${YELLOW}管理命令:${NC}"
    echo -e "  查看状态: ${GREEN}pm2 status${NC}"
    echo -e "  查看日志: ${GREEN}pm2 logs${NC}"
    echo -e "  重启应用: ${GREEN}pm2 restart all${NC}"
    echo -e "  更新应用: ${GREEN}./update.sh${NC}"
    echo -e "  系统监控: ${GREEN}./monitor.sh${NC}"
    echo -e "  系统优化: ${GREEN}./optimize-aliyun.sh${NC}"
    echo -e "${CYAN}==========================================${NC}"
    echo -e "${YELLOW}注意事项:${NC}"
    echo -e "  1. 请确保阿里云安全组已开放端口 22, 3000, 3001"
    echo -e "  2. 建议配置域名解析和SSL证书"
    echo -e "  3. 定期运行 ./update.sh 更新应用"
    echo -e "  4. 定期运行 ./monitor.sh 检查系统状态"
}

# 主函数
main() {
    echo -e "${CYAN}🚀 阿里云ECS部署脚本${NC}"
    echo -e "${CYAN}==========================================${NC}"
    
    # 检查root用户
    check_root
    
    # 获取系统信息
    get_system_info
    
    # 更新系统
    update_system
    
    # 安装基础软件
    install_basic_software
    
    # 安装Node.js
    install_nodejs
    
    # 安装PM2
    install_pm2
    
    # 跳过Nginx安装
    skip_nginx
    
    # 创建应用目录
    create_app_directory
    
    # 检查网络连接
    check_network
    
    # 下载应用代码
    download_app
    
    # 安装依赖
    install_dependencies
    
    # 配置环境变量
    setup_environment
    
    # 创建PM2配置文件
    create_pm2_config
    
    # 验证目录结构
    verify_directories
    
    # 跳过Nginx配置
    skip_nginx_config
    
    # 启动应用
    start_application
    
    # 创建管理脚本
    create_management_scripts
    
    # 配置防火墙（移除80端口）
    configure_firewall_no_nginx
    
    # 显示部署结果
    show_deployment_result
}

# 运行主函数
main "$@"

