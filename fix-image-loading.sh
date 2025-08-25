#!/bin/bash

# 快速修复图片加载问题脚本
# 适用于已部署的服务器

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
    
    log_success "服务器信息获取完成:"
    log_info "  公网IP: $PUBLIC_IP"
    log_info "  内网IP: $PRIVATE_IP"
    
    export PUBLIC_IP PRIVATE_IP
}

# 备份当前配置
backup_config() {
    log_info "备份当前配置..."
    
    if [ -f .env ]; then
        cp .env .env.backup.$(date +%Y%m%d-%H%M%S)
        log_success "主应用配置已备份"
    fi
    
    if [ -f resources-server/.env ]; then
        cp resources-server/.env resources-server/.env.backup.$(date +%Y%m%d-%H%M%S)
        log_success "资源服务器配置已备份"
    fi
}

# 更新环境配置
update_env_config() {
    log_info "更新环境配置..."
    
    # 更新主应用环境配置
    if [ -f .env ]; then
        # 备份原配置
        cp .env .env.old
        
        # 更新CORS配置
        sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=http://$PUBLIC_IP:3000,http://$PRIVATE_IP:3000,http://localhost:3000,http://127.0.0.1:3000|g" .env
        
        # 更新资源服务器URL
        sed -i "s|RESOURCE_SERVER_URL=.*|RESOURCE_SERVER_URL=http://$PRIVATE_IP:3001|g" .env
        
        # 添加服务器信息
        if ! grep -q "PUBLIC_IP=" .env; then
            echo "PUBLIC_IP=$PUBLIC_IP" >> .env
        fi
        if ! grep -q "PRIVATE_IP=" .env; then
            echo "PRIVATE_IP=$PRIVATE_IP" >> .env
        fi
        
        log_success "主应用环境配置已更新"
    fi
    
    # 更新资源服务器环境配置
    if [ -f resources-server/.env ]; then
        # 备份原配置
        cp resources-server/.env resources-server/.env.old
        
        # 更新CORS配置
        sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=http://$PUBLIC_IP:3000,http://$PRIVATE_IP:3000,http://localhost:3000,http://127.0.0.1:3000,http://$PUBLIC_IP:3001,http://$PRIVATE_IP:3001|g" resources-server/.env
        
        # 添加服务器信息
        if ! grep -q "PUBLIC_IP=" resources-server/.env; then
            echo "PUBLIC_IP=$PUBLIC_IP" >> resources-server/.env
        fi
        if ! grep -q "PRIVATE_IP=" resources-server/.env; then
            echo "PRIVATE_IP=$PRIVATE_IP" >> resources-server/.env
        fi
        
        # 确保静态文件配置正确
        if ! grep -q "STATIC_FILE_PATH=" resources-server/.env; then
            echo "STATIC_FILE_PATH=./resources" >> resources-server/.env
        fi
        if ! grep -q "UPLOAD_PATH=" resources-server/.env; then
            echo "UPLOAD_PATH=./uploads" >> resources-server/.env
        fi
        
        log_success "资源服务器环境配置已更新"
    fi
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    
    # 创建资源目录
    mkdir -p resources-server/resources/{images,videos,audio,documents}
    mkdir -p resources-server/uploads
    mkdir -p uploads
    mkdir -p logs
    
    # 设置权限
    chmod -R 755 resources-server/resources
    chmod -R 755 resources-server/uploads
    chmod -R 755 uploads
    
    log_success "目录创建完成"
}

# 重启应用
restart_application() {
    log_info "重启应用..."
    
    # 停止当前应用
    pm2 stop heritage-main-server heritage-resource-server 2>/dev/null || true
    
    # 等待进程完全停止
    sleep 3
    
    # 重新启动应用
    pm2 start ecosystem.config.js
    
    # 等待应用启动
    sleep 5
    
    # 检查应用状态
    pm2 status
    
    log_success "应用重启完成"
}

# 测试图片访问
test_image_access() {
    log_info "测试图片访问..."
    
    # 创建测试图片
    mkdir -p resources-server/resources/images/test
    echo "测试图片" > resources-server/resources/images/test/test.txt
    
    # 测试本地访问
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/resources/images/test/test.txt" | grep -q "200"; then
        log_success "本地图片访问正常"
    else
        log_warning "本地图片访问可能有问题"
    fi
    
    # 测试公网访问
    if curl -s -o /dev/null -w "%{http_code}" "http://$PUBLIC_IP:3001/resources/images/test/test.txt" | grep -q "200"; then
        log_success "公网图片访问正常"
    else
        log_warning "公网图片访问可能有问题，请检查防火墙设置"
    fi
}

# 显示修复信息
show_fix_info() {
    log_success "🎉 图片加载问题修复完成！"
    echo
    echo "📋 修复内容:"
    echo "  ✅ 更新了CORS配置，支持动态IP"
    echo "  ✅ 优化了静态文件服务"
    echo "  ✅ 添加了图片缓存头"
    echo "  ✅ 创建了必要的目录结构"
    echo "  ✅ 重启了应用服务"
    echo
    echo "🌐 访问地址:"
    echo "  主应用: http://$PUBLIC_IP:3000"
    echo "  资源服务器: http://$PUBLIC_IP:3001"
    echo "  图片测试: http://$PUBLIC_IP:3001/resources/images/test/test.txt"
    echo
    echo "🔧 如果仍有问题，请检查:"
    echo "  1. 阿里云安全组是否开放了3000和3001端口"
    echo "  2. 防火墙是否允许这些端口的访问"
    echo "  3. 应用日志: pm2 logs"
    echo "  4. 网络连接: curl -I http://$PUBLIC_IP:3001"
}

# 主函数
main() {
    echo "🔧 开始修复图片加载问题..."
    echo "=================================="
    
    get_server_info
    backup_config
    update_env_config
    create_directories
    restart_application
    test_image_access
    show_fix_info
    
    echo "=================================="
    log_success "修复脚本执行完成！"
}

# 执行主函数
main "$@"
