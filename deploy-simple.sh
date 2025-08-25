#!/bin/bash

# 非遗文化传承智能体助手 - 简化部署脚本（无Nginx）
# 适用于 Ubuntu 20.04+ 系统

set -e  # 遇到错误立即退出

echo "🚀 开始部署非遗文化传承智能体助手（简化版）..."

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

# 更新系统
log_info "更新系统包..."
sudo apt update && sudo apt upgrade -y

# 安装基础工具
log_info "安装基础工具..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# 安装Node.js 18.x
log_info "安装Node.js 18.x..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证Node.js安装
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log_success "Node.js版本: $NODE_VERSION"
log_success "npm版本: $NPM_VERSION"

# 安装PM2进程管理器
log_info "安装PM2进程管理器..."
sudo npm install -g pm2

# 安装防火墙并配置
log_info "配置防火墙..."
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw --force enable

# 创建应用目录
APP_DIR="/opt/heritage-app"
log_info "创建应用目录: $APP_DIR"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# 克隆项目（如果还没有）
if [ ! -d "$APP_DIR/.git" ]; then
    log_info "克隆项目到服务器..."
    git clone https://github.com/GuangQianHui/heritage-resource-manager.git $APP_DIR
else
    log_info "项目已存在，更新代码..."
    cd $APP_DIR
    git pull origin main
fi

# 进入应用目录
cd $APP_DIR

# 安装依赖
log_info "安装项目依赖..."
npm install

# 安装资源服务器依赖
log_info "安装资源服务器依赖..."
cd resources-server
npm install
cd ..

# 创建必要的目录
log_info "创建必要的目录..."
mkdir -p logs uploads
mkdir -p resources-server/resources/{images,videos,audio,documents}

# 创建环境配置文件
log_info "创建环境配置文件..."
cat > .env << EOF
# 生产环境配置
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
EOF

# 创建PM2配置文件
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
      time: true
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
      time: true
    }
  ]
};
EOF

# 启动应用
log_info "启动应用..."
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

# 设置PM2开机自启
pm2 startup

# 创建系统服务文件
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

[Install]
WantedBy=multi-user.target
EOF

# 重新加载systemd并启用服务
sudo systemctl daemon-reload
sudo systemctl enable heritage-app.service

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

chmod +x update.sh

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

chmod +x monitor.sh

# 显示部署结果
log_success "🎉 部署完成！"
echo ""
echo "📋 部署信息:"
echo "=================="
echo "应用目录: $APP_DIR"
echo "主服务器端口: 3000"
echo "资源服务器端口: 3001"
echo ""
echo "🔧 管理命令:"
echo "=================="
echo "查看应用状态: pm2 status"
echo "查看日志: pm2 logs"
echo "重启应用: pm2 restart all"
echo "停止应用: pm2 stop all"
echo "更新应用: ./update.sh"
echo "监控系统: ./monitor.sh"
echo ""
echo "🌐 访问地址:"
echo "=================="
echo "主应用: http://$(curl -s ifconfig.me):3000"
echo "资源服务器: http://$(curl -s ifconfig.me):3001"
echo ""
echo "⚠️  重要提醒:"
echo "=================="
echo "1. 应用直接运行在端口3000和3001上"
echo "2. 如果需要域名访问，请配置域名解析到服务器IP"
echo "3. 如果需要HTTPS，建议配置Nginx反向代理"
echo "4. 定期运行 ./update.sh 更新应用"
echo "5. 使用 ./monitor.sh 监控系统状态"
echo ""
echo "🔒 安全建议:"
echo "=================="
echo "1. 确保防火墙已启用（脚本已配置）"
echo "2. 定期更新系统和应用"
echo "3. 监控应用日志"
echo "4. 考虑配置SSL证书"
echo ""
log_success "简化部署脚本执行完成！"
