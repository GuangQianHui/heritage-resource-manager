#!/usr/bin/env node

/**
 * 模块化资源服务器启动器
 * 用于启动独立的资源服务器实例
 */

const path = require('path');
const { spawn } = require('child_process');

// 配置
const CONFIG = {
    serverScript: path.join(__dirname, 'server.js'),
    port: process.env.PORT || 3001,
    modular: true
};

console.log('🚀 模块化资源服务器启动器');
console.log('==========================================');
console.log(`📦 服务器脚本: ${CONFIG.serverScript}`);
console.log(`🔧 端口: ${CONFIG.port}`);
console.log(`⚙️  模式: 模块化`);
console.log('==========================================');

// 启动服务器
function startModularServer() {
    console.log('🔄 正在启动模块化资源服务器...');
    
    const env = {
        ...process.env,
        PORT: CONFIG.port.toString(),
        MODULAR_MODE: 'true'
    };
    
    const serverProcess = spawn('node', [CONFIG.serverScript], {
        stdio: 'inherit',
        env: env,
        cwd: __dirname
    });
    
    serverProcess.on('error', (error) => {
        console.error('❌ 启动模块化服务器失败:', error.message);
        process.exit(1);
    });
    
    serverProcess.on('exit', (code) => {
        if (code !== 0) {
            console.error(`❌ 模块化服务器异常退出 (代码: ${code})`);
            process.exit(code);
        }
    });
    
    // 优雅关闭
    process.on('SIGINT', () => {
        console.log('\n🛑 正在关闭模块化服务器...');
        serverProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 正在关闭模块化服务器...');
        serverProcess.kill('SIGTERM');
    });
}

// 检查服务器脚本是否存在
const fs = require('fs');
if (!fs.existsSync(CONFIG.serverScript)) {
    console.error(`❌ 服务器脚本不存在: ${CONFIG.serverScript}`);
    process.exit(1);
}

// 启动服务器
startModularServer();
