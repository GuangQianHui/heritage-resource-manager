#!/bin/bash

# 非遗文化传承智能体助手 - 阿里云服务器专用部署脚本
# 适用于阿里云ECS（CentOS 7+ / Ubuntu 18.04+）

set -e  # 遇到错误立即退出

echo "🚀 开始部署非遗文化传承智能体助手到阿里云服务器..."

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

# 检查是否为root用户
if [[ $EUID -eq 0 ]]; then
   log_error "请不要使用root用户运行此脚本"
   exit 1
fi

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        OS=$DISTRIB_ID
        VER=$DISTRIB_RELEASE
    elif [ -f /etc/debian_version ]; then
        OS=Debian
        VER=$(cat /etc/debian_version)
    elif [ -f /etc/SuSe-release ]; then
        OS=SuSE
    elif [ -f /etc/redhat-release ]; then
        OS=RedHat
        VER=$(cat /etc/redhat-release | sed 's/.*release \([0-9.]*\).*/\1/')
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    log_info "检测到操作系统: $OS $VER"
}

# 更新系统包
update_system() {
    log_info "更新系统包..."
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        sudo apt update && sudo apt upgrade -y
        sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"RedHat"* ]] || [[ "$OS" == *"Amazon"* ]]; then
        sudo yum update -y
        sudo yum install -y curl wget git unzip epel-release
    else
        log_warning "未知操作系统，尝试使用通用包管理器..."
        sudo apt update && sudo apt upgrade -y || sudo yum update -y
    fi
}

# 安装Node.js
install_nodejs() {
    log_info "安装Node.js 18.x..."
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        # Ubuntu/Debian
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"RedHat"* ]] || [[ "$OS" == *"Amazon"* ]]; then
        # CentOS/RHEL/Amazon Linux
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        log_error "不支持的操作系统，请手动安装Node.js 18.x"
        exit 1
    fi

    # 验证Node.js安装
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log_success "Node.js版本: $NODE_VERSION"
    log_success "npm版本: $NPM_VERSION"
}

# 安装PM2
install_pm2() {
    log_info "安装PM2进程管理器..."
    sudo npm install -g pm2
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        # UFW防火墙
        sudo ufw allow ssh
        sudo ufw allow 3000
        sudo ufw allow 3001
        sudo ufw --force enable
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"RedHat"* ]] || [[ "$OS" == *"Amazon"* ]]; then
        # firewalld防火墙
        sudo systemctl start firewalld
        sudo systemctl enable firewalld
        sudo firewall-cmd --permanent --add-service=ssh
        sudo firewall-cmd --permanent --add-port=3000/tcp
        sudo firewall-cmd --permanent --add-port=3001/tcp
        sudo firewall-cmd --reload
    else
        log_warning "未知防火墙系统，请手动配置端口3000和3001"
    fi
}

# 创建应用目录
create_app_directory() {
    APP_DIR="/opt/heritage-app"
    log_info "创建应用目录: $APP_DIR"
    sudo mkdir -p $APP_DIR
    sudo chown $USER:$USER $APP_DIR
}

# 克隆项目
clone_project() {
    if [ ! -d "$APP_DIR/.git" ]; then
        log_info "克隆项目到服务器..."
        git clone https://github.com/GuangQianHui/heritage-resource-manager.git $APP_DIR
    else
        log_info "项目已存在，更新代码..."
        cd $APP_DIR
        git pull origin main
    fi
}

# 安装依赖
install_dependencies() {
    cd $APP_DIR
    
    log_info "安装项目依赖..."
    npm install

    log_info "安装资源服务器依赖..."
    cd resources-server
    npm install
    cd ..
}

# 创建必要目录
create_directories() {
    log_info "创建必要的目录..."
    mkdir -p logs uploads
    mkdir -p resources-server/resources/{images,videos,audio,documents}
}

# 创建环境配置
create_env_config() {
    log_info "创建环境配置文件..."
    cat > .env << EOF
# 阿里云生产环境配置
NODE_ENV=production
PORT=3000
RESOURCE_SERVER_URL=http://localhost:3001

# 安全配置
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# 文件上传配置
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# 阿里云特定配置
ALIYUN_REGION=cn-hangzhou
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
EOF
}

# 创建PM2配置
create_pm2_config() {
    log_info "创建PM2配置文件..."
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'heritage-main-server',
      script: 'server.js',
      cwd: '$APP_DIR',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/main-error.log',
      out_file: './logs/main-out.log',
      log_file: './logs/main-combined.log',
      time: true,
      // 阿里云优化配置
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'heritage-resource-server',
      script: 'server.js',
      cwd: '$APP_DIR/resources-server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '../logs/resource-error.log',
      out_file: '../logs/resource-out.log',
      log_file: '../logs/resource-combined.log',
      time: true,
      // 阿里云优化配置
      node_args: '--max-old-space-size=1024'
    }
  ]
};
EOF
}

# 启动应用
start_application() {
    log_info "启动应用..."
    pm2 start ecosystem.config.js
    
    # 保存PM2配置
    pm2 save
    
    # 设置PM2开机自启
    pm2 startup
}

# 创建系统服务
create_system_service() {
    log_info "创建系统服务文件..."
    sudo tee /etc/systemd/system/heritage-app.service > /dev/null << EOF
[Unit]
Description=Heritage Resource Manager
After=network.target

[Service]
Type=forking
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload ecosystem.config.js
ExecStop=/usr/bin/pm2 stop ecosystem.config.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    # 重新加载systemd并启用服务
    sudo systemctl daemon-reload
    sudo systemctl enable heritage-app.service
}

# 创建管理脚本
create_management_scripts() {
    # 创建更新脚本
    log_info "创建更新脚本..."
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

    # 创建监控脚本
    log_info "创建监控脚本..."
    cat > monitor.sh << 'EOF'
#!/bin/bash
echo "📊 应用状态监控"
echo "=================="
pm2 status
echo ""
echo "📈 系统资源使用"
echo "=================="
echo "CPU使用率:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
echo ""
echo "内存使用:"
free -h
echo ""
echo "磁盘使用:"
df -h
echo ""
echo "📋 最近日志"
echo "=================="
pm2 logs --lines 10
EOF

    # 创建阿里云优化脚本
    log_info "创建阿里云优化脚本..."
    cat > optimize-aliyun.sh << 'EOF'
#!/bin/bash
echo "🔧 阿里云服务器优化..."

# 优化系统参数
echo "优化系统参数..."
sudo sysctl -w net.core.somaxconn=65535
sudo sysctl -w net.ipv4.tcp_max_syn_backlog=65535
sudo sysctl -w net.ipv4.tcp_fin_timeout=30
sudo sysctl -w net.ipv4.tcp_keepalive_time=1200
sudo sysctl -w net.ipv4.tcp_max_tw_buckets=5000

# 优化文件描述符限制
echo "优化文件描述符限制..."
echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf

# 优化Node.js内存
echo "优化Node.js内存配置..."
export NODE_OPTIONS="--max-old-space-size=1024"

echo "✅ 阿里云优化完成！"
EOF

    chmod +x update.sh monitor.sh optimize-aliyun.sh
}

# 获取阿里云实例信息
get_aliyun_info() {
    log_info "获取阿里云实例信息..."
    
    # 尝试获取实例ID
    if command -v curl >/dev/null 2>&1; then
        INSTANCE_ID=$(curl -s http://100.100.100.200/latest/meta-data/instance-id 2>/dev/null || echo "unknown")
        REGION_ID=$(curl -s http://100.100.100.200/latest/meta-data/region-id 2>/dev/null || echo "unknown")
        ZONE_ID=$(curl -s http://100.100.100.200/latest/meta-data/zone-id 2>/dev/null || echo "unknown")
        
        log_info "阿里云实例ID: $INSTANCE_ID"
        log_info "阿里云地域: $REGION_ID"
        log_info "阿里云可用区: $ZONE_ID"
    else
        log_warning "无法获取阿里云实例信息"
    fi
}

# 显示部署结果
show_deployment_result() {
    log_success "🎉 阿里云部署完成！"
    echo ""
    echo "📋 部署信息:"
    echo "=================="
    echo "应用目录: $APP_DIR"
    echo "主服务器端口: 3000"
    echo "资源服务器端口: 3001"
    echo "操作系统: $OS $VER"
    echo ""
    echo "🔧 管理命令:"
    echo "=================="
    echo "查看应用状态: pm2 status"
    echo "查看日志: pm2 logs"
    echo "重启应用: pm2 restart all"
    echo "停止应用: pm2 stop all"
    echo "更新应用: ./update.sh"
    echo "监控系统: ./monitor.sh"
    echo "阿里云优化: ./optimize-aliyun.sh"
    echo ""
    echo "🌐 访问地址:"
    echo "=================="
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "您的服务器IP")
    echo "主应用: http://$PUBLIC_IP:3000"
    echo "资源服务器: http://$PUBLIC_IP:3001"
    echo ""
    echo "⚠️  重要提醒:"
    echo "=================="
    echo "1. 应用直接运行在端口3000和3001上"
    echo "2. 确保阿里云安全组已开放3000和3001端口"
    echo "3. 建议配置域名解析到阿里云ECS公网IP"
    echo "4. 定期运行 ./update.sh 更新应用"
    echo "5. 使用 ./monitor.sh 监控系统状态"
    echo "6. 运行 ./optimize-aliyun.sh 进行阿里云优化"
    echo ""
    echo "🔒 安全建议:"
    echo "=================="
    echo "1. 确保防火墙已启用（脚本已配置）"
    echo "2. 定期更新系统和应用"
    echo "3. 监控应用日志"
    echo "4. 配置阿里云安全组规则"
    echo "5. 考虑使用阿里云SLB负载均衡"
    echo ""
    echo "📞 阿里云支持:"
    echo "=================="
    echo "阿里云控制台: https://ecs.console.aliyun.com/"
    echo "阿里云文档: https://help.aliyun.com/"
    echo "项目文档: https://github.com/GuangQianHui/heritage-resource-manager"
    echo ""
    log_success "阿里云部署脚本执行完成！"
}

# 主执行流程
main() {
    detect_os
    update_system
    install_nodejs
    install_pm2
    configure_firewall
    create_app_directory
    clone_project
    install_dependencies
    create_directories
    create_env_config
    create_pm2_config
    start_application
    create_system_service
    create_management_scripts
    get_aliyun_info
    show_deployment_result
}

# 执行主函数
main
