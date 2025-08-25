#!/bin/bash

# 修复数据文件中硬编码IP地址的脚本
# 将192.168.203.1替换为动态获取的公网IP

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

# 获取公网IP
get_public_ip() {
    log_info "获取公网IP..."
    
    # 获取公网IP
    PUBLIC_IP=$(curl -s --max-time 10 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || 
                curl -s --max-time 10 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null ||
                curl -s --max-time 10 ifconfig.me 2>/dev/null ||
                curl -s --max-time 10 ipinfo.io/ip 2>/dev/null ||
                echo "localhost")
    
    log_success "公网IP: $PUBLIC_IP"
    export PUBLIC_IP
}

# 备份数据文件
backup_data_files() {
    log_info "备份数据文件..."
    
    BACKUP_DIR="/opt/heritage-app/data-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # 备份所有数据文件
    cp -r /opt/heritage-app/resources-server/resources/knowledge $BACKUP_DIR/
    
    log_success "数据文件已备份到: $BACKUP_DIR"
    export BACKUP_DIR
}

# 修复数据文件中的IP地址
fix_ip_urls() {
    log_info "修复数据文件中的IP地址..."
    
    DATA_DIR="/opt/heritage-app/resources-server/resources/knowledge"
    
    if [ ! -d "$DATA_DIR" ]; then
        log_error "数据目录不存在: $DATA_DIR"
        exit 1
    fi
    
    # 查找所有包含硬编码IP的文件
    FILES_TO_FIX=$(grep -r "192.168.203.1" $DATA_DIR --include="*.json" -l)
    
    if [ -z "$FILES_TO_FIX" ]; then
        log_warning "未找到包含硬编码IP的文件"
        return
    fi
    
    log_info "找到需要修复的文件:"
    echo "$FILES_TO_FIX"
    
    # 修复每个文件
    for file in $FILES_TO_FIX; do
        log_info "修复文件: $file"
        
        # 创建临时文件
        temp_file=$(mktemp)
        
        # 替换IP地址
        sed "s|192\.168\.203\.1|$PUBLIC_IP|g" "$file" > "$temp_file"
        
        # 检查替换是否成功
        if grep -q "$PUBLIC_IP" "$temp_file"; then
            # 备份原文件
            cp "$file" "$file.backup"
            
            # 替换原文件
            mv "$temp_file" "$file"
            
            log_success "文件修复完成: $file"
        else
            log_warning "文件修复失败: $file"
            rm "$temp_file"
        fi
    done
}

# 验证修复结果
verify_fix() {
    log_info "验证修复结果..."
    
    DATA_DIR="/opt/heritage-app/resources-server/resources/knowledge"
    
    # 检查是否还有硬编码的IP
    REMAINING_IPS=$(grep -r "192.168.203.1" $DATA_DIR --include="*.json" || true)
    
    if [ -z "$REMAINING_IPS" ]; then
        log_success "所有硬编码IP已成功替换"
    else
        log_warning "仍有硬编码IP存在:"
        echo "$REMAINING_IPS"
    fi
    
    # 检查新IP的使用情况
    NEW_IPS=$(grep -r "$PUBLIC_IP" $DATA_DIR --include="*.json" | wc -l)
    log_info "新IP使用次数: $NEW_IPS"
}

# 创建动态IP获取的前端脚本
create_dynamic_ip_script() {
    log_info "创建动态IP获取脚本..."
    
    cat > /opt/heritage-app/public/dynamic-ip.js << EOF
// 动态IP获取脚本
(function() {
    'use strict';
    
    // 获取当前页面的协议和主机
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port;
    
    // 构建基础URL
    const baseUrl = \`\${protocol}//\${host}\${port ? ':' + port : ''}\`;
    
    // 资源服务器URL（使用相对路径，避免硬编码IP）
    const resourceServerUrl = \`\${baseUrl.replace(':3000', ':3001')}\`;
    
    // 全局配置对象
    window.ServerConfig = {
        baseUrl: baseUrl,
        resourceServerUrl: resourceServerUrl,
        apiUrl: \`\${resourceServerUrl}/api/resources\`,
        resourcesUrl: \`\${resourceServerUrl}/resources\`
    };
    
    console.log('动态IP配置已加载:', window.ServerConfig);
    
    // 修复现有数据中的URL
    function fixDataUrls(data) {
        if (!data || typeof data !== 'object') return data;
        
        if (Array.isArray(data)) {
            return data.map(item => fixDataUrls(item));
        }
        
        const fixed = {};
        for (const [key, value] of Object.entries(data)) {
            if (key === 'url' && typeof value === 'string' && value.includes('192.168.203.1')) {
                // 替换硬编码IP为动态IP
                fixed[key] = value.replace('http://192.168.203.1:3001', window.ServerConfig.resourceServerUrl);
            } else if (typeof value === 'object') {
                fixed[key] = fixDataUrls(value);
            } else {
                fixed[key] = value;
            }
        }
        return fixed;
    }
    
    // 重写fetch方法来自动修复URL
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (typeof url === 'string' && url.includes('192.168.203.1')) {
            url = url.replace('http://192.168.203.1:3001', window.ServerConfig.resourceServerUrl);
        }
        return originalFetch(url, options);
    };
    
    // 重写XMLHttpRequest来自动修复URL
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        if (typeof url === 'string' && url.includes('192.168.203.1')) {
            url = url.replace('http://192.168.203.1:3001', window.ServerConfig.resourceServerUrl);
        }
        return originalOpen.call(this, method, url, ...args);
    };
    
    // 页面加载完成后修复现有元素
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixExistingElements);
    } else {
        fixExistingElements();
    }
    
    function fixExistingElements() {
        // 修复图片src
        const images = document.querySelectorAll('img[src*="192.168.203.1"]');
        images.forEach(img => {
            img.src = img.src.replace('http://192.168.203.1:3001', window.ServerConfig.resourceServerUrl);
        });
        
        // 修复视频src
        const videos = document.querySelectorAll('video source[src*="192.168.203.1"]');
        videos.forEach(source => {
            source.src = source.src.replace('http://192.168.203.1:3001', window.ServerConfig.resourceServerUrl);
        });
        
        // 修复链接href
        const links = document.querySelectorAll('a[href*="192.168.203.1"]');
        links.forEach(link => {
            link.href = link.href.replace('http://192.168.203.1:3001', window.ServerConfig.resourceServerUrl);
        });
    }
})();
EOF

    log_success "动态IP获取脚本已创建: /opt/heritage-app/public/dynamic-ip.js"
}

# 更新前端HTML文件
update_frontend() {
    log_info "更新前端HTML文件..."
    
    HTML_FILE="/opt/heritage-app/index.html"
    
    if [ ! -f "$HTML_FILE" ]; then
        log_error "HTML文件不存在: $HTML_FILE"
        return
    fi
    
    # 备份原文件
    cp "$HTML_FILE" "$HTML_FILE.backup"
    
    # 在head标签中添加动态IP脚本
    sed -i '/<head>/a\    <script src="dynamic-ip.js"></script>' "$HTML_FILE"
    
    log_success "前端HTML文件已更新"
}

# 重启应用
restart_application() {
    log_info "重启应用..."
    
    cd /opt/heritage-app
    
    # 重启PM2应用
    pm2 restart heritage-main-server heritage-resource-server
    
    # 等待应用启动
    sleep 5
    
    # 检查应用状态
    pm2 status
    
    log_success "应用重启完成"
}

# 显示修复信息
show_fix_info() {
    log_success "🎉 IP地址修复完成！"
    echo
    echo "📋 修复内容:"
    echo "  ✅ 备份了原始数据文件"
    echo "  ✅ 替换了硬编码IP地址"
    echo "  ✅ 创建了动态IP获取脚本"
    echo "  ✅ 更新了前端HTML文件"
    echo "  ✅ 重启了应用服务"
    echo
    echo "🌐 服务器信息:"
    echo "  公网IP: $PUBLIC_IP"
    echo "  主应用: http://$PUBLIC_IP:3000"
    echo "  资源服务器: http://$PUBLIC_IP:3001"
    echo
    echo "📁 备份位置: $BACKUP_DIR"
    echo
    echo "🔧 如果仍有问题，请检查:"
    echo "  1. 浏览器缓存是否已清除"
    echo "  2. 应用日志: pm2 logs"
    echo "  3. 网络连接: curl -I http://$PUBLIC_IP:3001"
}

# 主函数
main() {
    echo "🔧 开始修复IP地址问题..."
    echo "=================================="
    
    get_public_ip
    backup_data_files
    fix_ip_urls
    verify_fix
    create_dynamic_ip_script
    update_frontend
    restart_application
    show_fix_info
    
    echo "=================================="
    log_success "IP地址修复脚本执行完成！"
}

# 执行主函数
main "$@"
