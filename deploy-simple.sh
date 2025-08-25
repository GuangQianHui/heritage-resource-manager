#!/bin/bash

# 非遗文化传承智能体助手 - 简化部署脚本（无Nginx）- 优化版
# 支持动态IP获取，多服务器部署，优化静态文件服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 获取服务器信息
get_server_info() {
    log_info "获取服务器信息..."
    
    # 获取公网IP
    PUBLIC_IP=$(curl -s --max-time 10 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || 
                curl -s --max-time 10 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null ||
                curl -s --max-time 10 ifconfig.me 2>/dev/null ||
                curl -s --max-time 10 ipinfo.io/ip 2>/dev/null ||
                echo "localhost")
    
    # 获取内网IP
    PRIVATE_IP=$(curl -s --max-time 10 http://100.100.100.200/latest/meta-data/private-ipv4 2>/dev/null ||
                 curl -s --max-time 10 http://169.254.169.254/latest/meta-data/local-ipv4 2>/dev/null ||
                 hostname -I | awk '{print $1}' ||
                 echo "127.0.0.1")
    
    # 获取实例ID
    INSTANCE_ID=$(curl -s --max-time 10 http://100.100.100.200/latest/meta-data/instance-id 2>/dev/null ||
                  curl -s --max-time 10 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null ||
                  echo "unknown")
    
    # 获取可用区
    ZONE=$(curl -s --max-time 10 http://100.100.100.200/latest/meta-data/zone-id 2>/dev/null ||
           curl -s --max-time 10 http://169.254.169.254/latest/meta-data/placement/availability-zone 2>/dev/null ||
           echo "unknown")
    
    log_success "服务器信息获取完成:"
    log_info "  公网IP: $PUBLIC_IP"
    log_info "  内网IP: $PRIVATE_IP"
    log_info "  实例ID: $INSTANCE_ID"
    log_info "  可用区: $ZONE"
    
    # 导出变量供后续使用
    export PUBLIC_IP PRIVATE_IP INSTANCE_ID ZONE
}

# 更新系统
update_system() {
    log_info "更新系统包..."
    sudo apt update && sudo apt upgrade -y
}

# 安装基础工具
install_dependencies() {
    log_info "安装基础工具..."
    sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release build-essential
}

# 安装Node.js 18.x
install_nodejs() {
    log_info "安装Node.js 18.x..."
    
    # 检查是否已安装
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_info "Node.js已安装: $NODE_VERSION"
        return
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # 验证Node.js安装
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log_success "Node.js版本: $NODE_VERSION"
    log_success "npm版本: $NPM_VERSION"
}

# 安装PM2进程管理器
install_pm2() {
    log_info "安装PM2进程管理器..."
    
    if command -v pm2 &> /dev/null; then
        log_info "PM2已安装"
        return
    fi
    
    sudo npm install -g pm2
    
    # 验证安装
    PM2_VERSION=$(pm2 --version)
    log_success "PM2安装完成: $PM2_VERSION"
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."
    sudo ufw allow ssh
    sudo ufw allow 3000
    sudo ufw allow 3001
    sudo ufw --force enable
    log_success "防火墙配置完成"
}

# 创建应用目录
create_app_directory() {
    log_info "创建应用目录..."
    
    APP_DIR="/opt/heritage-app"
    
    # 检查目录是否已存在
    if [ -d "$APP_DIR" ]; then
        log_warning "应用目录已存在: $APP_DIR"
        
        # 询问是否备份现有数据
        read -p "是否备份现有数据到 /opt/heritage-app-backup-$(date +%Y%m%d-%H%M%S)? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            BACKUP_DIR="/opt/heritage-app-backup-$(date +%Y%m%d-%H%M%S)"
            log_info "备份现有数据到: $BACKUP_DIR"
            sudo cp -r $APP_DIR $BACKUP_DIR
            sudo chown -R $USER:$USER $BACKUP_DIR
            log_success "备份完成: $BACKUP_DIR"
        fi
        
        # 清理现有目录
        log_info "清理现有目录..."
        sudo rm -rf $APP_DIR
    fi
    
    # 创建主应用目录
    log_info "创建主应用目录: $APP_DIR"
    sudo mkdir -p $APP_DIR
    
    # 创建完整的目录结构
    log_info "创建完整的目录结构..."
    sudo mkdir -p $APP_DIR/{logs,uploads,temp,backups}
    sudo mkdir -p $APP_DIR/resources-server/{resources/{images,videos,audio,documents},uploads,logs,temp}
    sudo mkdir -p $APP_DIR/config
    sudo mkdir -p $APP_DIR/scripts
    
    # 设置目录权限
    log_info "设置目录权限..."
    sudo chown -R $USER:$USER $APP_DIR
    sudo chmod -R 755 $APP_DIR
    
    # 设置特殊权限
    sudo chmod 775 $APP_DIR/logs
    sudo chmod 775 $APP_DIR/uploads
    sudo chmod 775 $APP_DIR/resources-server/uploads
    sudo chmod 775 $APP_DIR/resources-server/logs
    
    # 创建必要的空文件
    log_info "创建必要的空文件..."
    touch $APP_DIR/logs/.gitkeep
    touch $APP_DIR/uploads/.gitkeep
    touch $APP_DIR/resources-server/uploads/.gitkeep
    touch $APP_DIR/resources-server/logs/.gitkeep
    
    # 验证目录创建
    if [ -d "$APP_DIR" ] && [ -w "$APP_DIR" ]; then
        log_success "应用目录创建完成: $APP_DIR"
        log_info "目录结构:"
        tree $APP_DIR -L 3 2>/dev/null || find $APP_DIR -type d | head -20
    else
        log_error "应用目录创建失败: $APP_DIR"
        exit 1
    fi
    
    # 检查磁盘空间
    DISK_SPACE=$(df -h $APP_DIR | awk 'NR==2 {print $4}')
    log_info "可用磁盘空间: $DISK_SPACE"
    
    # 检查内存
    MEMORY=$(free -h | awk 'NR==2 {print $7}')
    log_info "可用内存: $MEMORY"
    
    export APP_DIR
}

# 下载应用代码
download_application() {
    log_info "下载应用代码..."
    
    cd $APP_DIR
    
    # 清理旧文件
    rm -rf *
    
    # 从GitHub下载最新代码
    git clone https://github.com/GuangQianHui/heritage-resource-manager.git .
    
    # 安装依赖
    log_info "安装主应用依赖..."
    npm install
    
    log_info "安装资源服务器依赖..."
    cd resources-server
    npm install
    cd ..
    
    log_success "应用代码下载完成"
}

# 创建环境配置文件
create_env_config() {
    log_info "创建环境配置文件..."
    
    # 主应用环境配置
    cat > .env << EOF
# 主应用配置
NODE_ENV=production
PORT=3000

# 资源服务器配置 - 使用公网IP确保前端可以访问
RESOURCE_SERVER_URL=http://$PUBLIC_IP:3001
RESOURCE_SERVER_MODULAR=false

# 服务器信息
PUBLIC_IP=$PUBLIC_IP
PRIVATE_IP=$PRIVATE_IP
INSTANCE_ID=$INSTANCE_ID
ZONE=$ZONE

# 安全配置 - 主要使用公网IP
CORS_ORIGINS=http://$PUBLIC_IP:3000,http://$PUBLIC_IP:3001,http://localhost:3000,http://127.0.0.1:3000
EOF

    # 资源服务器环境配置
    cat > resources-server/.env << EOF
# 资源服务器配置
NODE_ENV=production
PORT=3001

# 服务器信息
PUBLIC_IP=$PUBLIC_IP
PRIVATE_IP=$PRIVATE_IP
INSTANCE_ID=$INSTANCE_ID
ZONE=$ZONE

# CORS配置 - 主要使用公网IP，确保前端可以访问
CORS_ORIGINS=http://$PUBLIC_IP:3000,http://$PUBLIC_IP:3001,http://localhost:3000,http://127.0.0.1:3000

# 静态文件配置
STATIC_FILE_PATH=./resources
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=100mb
EOF

    log_success "环境配置文件创建完成"
}

# 创建优化的服务器配置
create_optimized_configs() {
    log_info "创建优化的服务器配置..."
    
    # 创建主应用配置文件
    cat > server-config.js << EOF
// 主应用优化配置
const os = require('os');

module.exports = {
    // 服务器信息
    serverInfo: {
        publicIP: process.env.PUBLIC_IP || '$PUBLIC_IP',
        privateIP: process.env.PRIVATE_IP || '$PRIVATE_IP',
        instanceId: process.env.INSTANCE_ID || '$INSTANCE_ID',
        zone: process.env.ZONE || '$ZONE',
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB'
    },
    
    // 性能优化
    performance: {
        maxOldSpaceSize: 1024,
        gcInterval: 30000,
        requestTimeout: 30000,
        uploadTimeout: 300000
    },
    
    // 安全配置
    security: {
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
            'http://$PUBLIC_IP:3000',
            'http://$PRIVATE_IP:3000',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ],
        rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: 500
        }
    }
};
EOF

    # 创建资源服务器配置文件
    cat > resources-server/server-config.js << EOF
// 资源服务器优化配置
const os = require('os');

module.exports = {
    // 服务器信息
    serverInfo: {
        publicIP: process.env.PUBLIC_IP || '$PUBLIC_IP',
        privateIP: process.env.PRIVATE_IP || '$PRIVATE_IP',
        instanceId: process.env.INSTANCE_ID || '$INSTANCE_ID',
        zone: process.env.ZONE || '$ZONE',
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB'
    },
    
    // 性能优化
    performance: {
        maxOldSpaceSize: 1024,
        gcInterval: 30000,
        requestTimeout: 30000,
        uploadTimeout: 300000,
        compressionLevel: 6
    },
    
    // 安全配置
    security: {
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
            'http://$PUBLIC_IP:3000',
            'http://$PRIVATE_IP:3000',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://$PUBLIC_IP:3001',
            'http://$PRIVATE_IP:3001'
        ],
        rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: 500,
            strictMax: 100
        }
    },
    
    // 文件配置
    files: {
        staticPath: process.env.STATIC_FILE_PATH || './resources',
        uploadPath: process.env.UPLOAD_PATH || './uploads',
        maxFileSize: process.env.MAX_FILE_SIZE || '100mb',
        allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp3', 'mp4', 'wav', 'pdf', 'doc', 'docx']
    }
};
EOF

    log_success "优化配置文件创建完成"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    mkdir -p logs uploads
    mkdir -p resources-server/resources/{images,videos,audio,documents}
    mkdir -p resources-server/uploads
    
    # 设置权限
    chmod -R 755 resources-server/resources
    chmod -R 755 resources-server/uploads
    chmod -R 755 uploads
    
    log_success "目录创建完成"
}

# 创建PM2配置文件
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
        PORT: 3000,
        PUBLIC_IP: '$PUBLIC_IP',
        PRIVATE_IP: '$PRIVATE_IP',
        INSTANCE_ID: '$INSTANCE_ID',
        ZONE: '$ZONE'
      },
      error_file: './logs/main-error.log',
      out_file: './logs/main-out.log',
      log_file: './logs/main-combined.log',
      time: true,
      // 性能优化配置
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
        PORT: 3001,
        PUBLIC_IP: '$PUBLIC_IP',
        PRIVATE_IP: '$PRIVATE_IP',
        INSTANCE_ID: '$INSTANCE_ID',
        ZONE: '$ZONE'
      },
      error_file: '../logs/resource-error.log',
      out_file: '../logs/resource-out.log',
      log_file: '../logs/resource-combined.log',
      time: true,
      // 性能优化配置
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
    
    log_success "应用启动完成"
}

# 创建系统服务文件
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
    
    log_success "系统服务创建完成"
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

# 备份当前配置
cp .env .env.backup
cp resources-server/.env resources-server/.env.backup

# 拉取最新代码
git pull origin main

# 恢复配置
cp .env.backup .env
cp resources-server/.env.backup resources-server/.env

# 安装依赖
npm install
cd resources-server && npm install && cd ..

# 重启服务
pm2 start ecosystem.config.js

echo "✅ 更新完成"
EOF

    # 创建状态检查脚本
    cat > status.sh << 'EOF'
#!/bin/bash
echo "📊 应用状态检查..."

echo "=== PM2 进程状态 ==="
pm2 status

echo -e "\n=== 端口监听状态 ==="
netstat -tlnp | grep -E ':(3000|3001)'

echo -e "\n=== 服务器信息 ==="
echo "公网IP: $PUBLIC_IP"
echo "内网IP: $PRIVATE_IP"
echo "实例ID: $INSTANCE_ID"
echo "可用区: $ZONE"

echo -e "\n=== 访问地址 ==="
echo "主应用: http://$PUBLIC_IP:3000"
echo "资源服务器: http://$PUBLIC_IP:3001"
echo "API接口: http://$PUBLIC_IP:3001/api/resources"
EOF

    # 创建日志查看脚本
    cat > logs.sh << 'EOF'
#!/bin/bash
echo "📋 日志查看工具..."

case "$1" in
    "main")
        pm2 logs heritage-main-server
        ;;
    "resource")
        pm2 logs heritage-resource-server
        ;;
    "all")
        pm2 logs
        ;;
    *)
        echo "用法: $0 {main|resource|all}"
        echo "  main     - 查看主应用日志"
        echo "  resource - 查看资源服务器日志"
        echo "  all      - 查看所有日志"
        ;;
esac
EOF

    # 创建重启脚本
    cat > restart.sh << 'EOF'
#!/bin/bash
echo "🔄 重启应用..."

pm2 restart heritage-main-server heritage-resource-server

echo "✅ 重启完成"
EOF

    # 创建健康检查脚本
    cat > health-check.js << EOF
const http = require('http');

const checks = [
    { name: '主应用', url: 'http://localhost:3000', port: 3000 },
    { name: '资源服务器', url: 'http://localhost:3001', port: 3001 }
];

async function checkHealth() {
    console.log('🏥 开始健康检查...');
    
    for (const check of checks) {
        try {
            const response = await new Promise((resolve, reject) => {
                const req = http.get(check.url, (res) => {
                    resolve(res);
                });
                
                req.on('error', (err) => {
                    reject(err);
                });
                
                req.setTimeout(5000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
            });
            
            if (response.statusCode === 200) {
                console.log(\`✅ \${check.name} (端口\${check.port}) - 正常\`);
            } else {
                console.log(\`⚠️  \${check.name} (端口\${check.port}) - 状态码: \${response.statusCode}\`);
            }
        } catch (error) {
            console.log(\`❌ \${check.name} (端口\${check.port}) - 错误: \${error.message}\`);
        }
    }
}

checkHealth();
EOF

    # 给脚本执行权限
    chmod +x update.sh status.sh logs.sh restart.sh
    
    log_success "管理脚本创建完成"
}

# 显示部署信息
show_deployment_info() {
    log_success "🎉 部署完成！"
    echo
    echo "📋 部署信息:"
    echo "  应用目录: $APP_DIR"
    echo "  公网IP: $PUBLIC_IP"
    echo "  内网IP: $PRIVATE_IP"
    echo "  实例ID: $INSTANCE_ID"
    echo "  可用区: $ZONE"
    echo
    echo "🌐 访问地址:"
    echo "  主应用: http://$PUBLIC_IP:3000"
    echo "  资源服务器: http://$PUBLIC_IP:3001"
    echo "  API接口: http://$PUBLIC_IP:3001/api/resources"
    echo
    echo "🔧 管理命令:"
    echo "  查看状态: ./status.sh"
    echo "  查看日志: ./logs.sh [main|resource|all]"
    echo "  重启应用: ./restart.sh"
    echo "  更新应用: ./update.sh"
    echo "  健康检查: node health-check.js"
    echo
    echo "📝 注意事项:"
    echo "  1. 应用直接运行在端口 3000 和 3001 上"
    echo "  2. 如需使用域名，请配置DNS解析到 $PUBLIC_IP"
    echo "  3. 建议配置SSL证书以支持HTTPS访问"
    echo "  4. 定期备份数据和配置文件"
    echo
    echo "🔒 安全建议:"
    echo "  1. 确保防火墙已启用（脚本已配置）"
    echo "  2. 定期更新系统和应用"
    echo "  3. 监控应用日志"
    echo "  4. 考虑配置SSL证书"
}

# 主函数
main() {
    echo "🚀 开始部署非遗文化传承智能体助手（简化版）..."
    echo "=================================="
    
    get_server_info
    update_system
    install_dependencies
    install_nodejs
    install_pm2
    configure_firewall
    create_app_directory
    download_application
    create_env_config
    create_optimized_configs
    create_directories
    create_pm2_config
    start_application
    create_system_service
    create_management_scripts
    show_deployment_info
    
    echo "=================================="
    log_success "简化部署脚本执行完成！"
}

# 执行主函数
main "$@"
