#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 配置
const config = {
    oldIP: 'localhost',
    newIP: '121.40.185.158',
    files: [
        'deploy.sh',
        'deploy-simple.sh',
        'deploy-simple-local.sh',
        'fix-image-loading.sh',
        'fix-ip-urls.sh'
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
    console.log(`${colors[color]}${timestamp} [部署脚本更新] ${message}${colors.reset}`);
}

// 更新单个文件
function updateFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            log(`❌ 文件不存在: ${filePath}`, 'red');
            return 0;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        let updatedContent = content;
        let totalMatches = 0;

        // 更新各种格式的localhost引用
        const patterns = [
            { old: `http://${config.oldIP}:`, new: `http://${config.newIP}:` },
            { old: `https://${config.oldIP}:`, new: `https://${config.newIP}:` },
            { old: `RESOURCE_SERVER_URL=http://${config.oldIP}:`, new: `RESOURCE_SERVER_URL=http://${config.newIP}:` },
            { old: `proxy_pass http://${config.oldIP}:`, new: `proxy_pass http://${config.newIP}:` },
            { old: `echo "${config.oldIP}"`, new: `echo "${config.newIP}"` }
        ];

        for (const pattern of patterns) {
            const regex = new RegExp(pattern.old.replace(/\./g, '\\.'), 'g');
            const matches = (content.match(regex) || []).length;
            if (matches > 0) {
                updatedContent = updatedContent.replace(regex, pattern.new);
                totalMatches += matches;
            }
        }
        
        if (totalMatches > 0) {
            fs.writeFileSync(filePath, updatedContent, 'utf8');
            log(`✅ 更新文件: ${filePath} (${totalMatches} 个匹配)`, 'green');
            return totalMatches;
        }
        
        return 0;
    } catch (error) {
        log(`❌ 更新文件失败: ${filePath} - ${error.message}`, 'red');
        return 0;
    }
}

// 主函数
async function main() {
    log('🔧 开始更新部署脚本配置...', 'bright');
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
    log(`✅ 部署脚本更新完成！`, 'green');
    log(`📊 更新文件数: ${filesUpdated}/${config.files.length}`, 'green');
    log(`📊 更新配置数: ${totalUpdated}`, 'green');
    log('==========================================', 'cyan');
    
    if (totalUpdated > 0) {
        log('💡 提示: 部署脚本已更新，下次部署时将使用新的IP地址', 'yellow');
    } else {
        log('ℹ️  没有找到需要更新的配置', 'blue');
    }
}

// 运行更新工具
main().catch(error => {
    log(`❌ 更新失败: ${error.message}`, 'red');
    process.exit(1);
});
