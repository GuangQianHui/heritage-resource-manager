#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 配置
const config = {
    oldIP: 'localhost',
    newIP: '121.40.185.158',
    files: [
        'server.js',
        'resources-server/server.js',
        'resources-server/config/config.js',
        'start-servers.js'
    ]
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors[color]}${timestamp} [配置更新] ${message}${colors.reset}`);
}

// 更新单个文件
function updateFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            log(`❌ 文件不存在: ${filePath}`, 'red');
            return 0;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const oldPattern = new RegExp(`http://${config.oldIP}:`, 'g');
        const newPattern = `http://${config.newIP}:`;
        
        if (content.includes(`http://${config.oldIP}:`)) {
            const newContent = content.replace(oldPattern, newPattern);
            fs.writeFileSync(filePath, newContent, 'utf8');
            
            const matches = (content.match(oldPattern) || []).length;
            log(`✅ 更新文件: ${filePath} (${matches} 个匹配)`, 'green');
            return matches;
        }
        
        return 0;
    } catch (error) {
        log(`❌ 更新文件失败: ${filePath} - ${error.message}`, 'red');
        return 0;
    }
}

// 主函数
async function main() {
    log('🔧 开始更新服务器配置文件...', 'bright');
    log('==========================================', 'cyan');
    log(`📝 旧IP地址: ${config.oldIP}`, 'yellow');
    log(`📝 新IP地址: ${config.newIP}`, 'yellow');
    log('==========================================', 'cyan');
    
    let totalUpdated = 0;
    let filesUpdated = 0;
    
    for (const file of config.files) {
        const updated = updateFile(file);
        if (updated > 0) {
            filesUpdated++;
            totalUpdated += updated;
        }
    }
    
    log('==========================================', 'cyan');
    log(`✅ 配置更新完成！`, 'green');
    log(`📊 更新文件数: ${filesUpdated}/${config.files.length}`, 'green');
    log(`📊 更新配置数: ${totalUpdated}`, 'green');
    log('==========================================', 'cyan');
    
    if (totalUpdated > 0) {
        log('💡 提示: 请重启服务器以使配置更改生效', 'yellow');
    } else {
        log('ℹ️  没有找到需要更新的配置', 'blue');
    }
}

// 运行更新工具
main().catch(error => {
    log(`❌ 更新失败: ${error.message}`, 'red');
    process.exit(1);
});
