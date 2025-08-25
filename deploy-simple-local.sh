#!/bin/bash

# 非遗文化传承智能体助手 - 本地部署脚本（跳过GitHub下载）
# 适用于已有代码的服务器

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

# 检查应用目录
check_app_directory() {
    APP_DIR="/opt/heritage-app"
    
    if [ ! -d "$APP_DIR" ]; then
        log_error "应用目录不存在: $APP_DIR"
        log_info "请先运行完整的部署脚本或手动创建目录"
        exit 1
    fi
    
    if [ ! -f "$APP_DIR/package.json" ]; then
        log_error "应用目录中缺少package.json文件"
        log_info "请确保应用代码已正确下载"
        exit 1
    fi
    
    log_success "应用目录检查通过: $APP_DIR"
    export APP_DIR
}

# 安装依赖
install_dependencies() {
    log_info "安装主应用依赖..."
    cd $APP_DIR
    npm install
    
    log_info "安装资源服务器依赖..."
    cd resources-server
    npm install
    cd ..
    
    log_success "依赖安装完成"
}

# 创建环境配置文件
create_env_config() {
    log_info "创建环境配置文件..."
    
    cd $APP_DIR
    
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

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    cd $APP_DIR
    
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
    cd $APP_DIR
    
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

# 重启应用
restart_application() {
    log_info "重启应用..."
    cd $APP_DIR
    
    # 停止当前应用
    pm2 stop heritage-main-server heritage-resource-server 2>/dev/null || true
    pm2 delete heritage-main-server heritage-resource-server 2>/dev/null || true
    
    # 等待进程完全停止
    sleep 3
    
    # 重新启动应用
    pm2 start ecosystem.config.js
    
    # 保存PM2配置
    pm2 save
    
    # 等待应用启动
    sleep 5
    
    # 检查应用状态
    pm2 status
    
    log_success "应用重启完成"
}

# 创建管理脚本
create_management_scripts() {
    log_info "创建管理脚本..."
    cd $APP_DIR
    
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
    chmod +x status.sh logs.sh restart.sh
    
    log_success "管理脚本创建完成"
}

# 显示部署信息
show_deployment_info() {
    log_success "🎉 本地部署完成！"
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
    echo "  健康检查: node health-check.js"
    echo
    echo "📝 注意事项:"
    echo "  1. 应用直接运行在端口 3000 和 3001 上"
    echo "  2. 如需使用域名，请配置DNS解析到 $PUBLIC_IP"
    echo "  3. 建议配置SSL证书以支持HTTPS访问"
    echo "  4. 定期备份数据和配置文件"
}

# 主函数
main() {
    echo "🚀 开始本地部署非遗文化传承智能体助手..."
    echo "=================================="
    
    get_server_info
    check_app_directory
    install_dependencies
    create_env_config
    create_directories
    create_pm2_config
    restart_application
    create_management_scripts
    show_deployment_info
    
    echo "=================================="
    log_success "本地部署脚本执行完成！"
}

# 执行主函数
main "$@"
