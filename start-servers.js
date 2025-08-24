#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// 配置
const config = {
    mainServer: {
        script: 'server.js',
        port: 3000,
        name: '主服务器'
    },
    resourceServer: {
        script: process.env.RESOURCE_SERVER_MODULAR === 'true' ? 'server-modular.js' : 'server.js',
        port: 3001,
        name: '资源服务器',
        cwd: path.join(__dirname, 'resources-server')
    }
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset', server = '') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = server ? `[${server}]` : '[启动器]';
    console.log(`${colors[color]}${timestamp} ${prefix} ${message}${colors.reset}`);
}

function startServer(serverConfig) {
    return new Promise((resolve, reject) => {
        log(`正在启动${serverConfig.name}...`, 'cyan', serverConfig.name);
        
        const child = spawn('node', [serverConfig.script], {
            cwd: serverConfig.cwd || __dirname,
            stdio: 'pipe',
            env: { ...process.env, PORT: serverConfig.port }
        });

        let output = '';
        let started = false;

        child.stdout.on('data', (data) => {
            const message = data.toString();
            output += message;
            
            // 检查是否启动成功
            if (message.includes('服务器已启动') || message.includes('listening')) {
                if (!started) {
                    started = true;
                    log(`${serverConfig.name}启动成功 (端口: ${serverConfig.port})`, 'green', serverConfig.name);
                    resolve(child);
                }
            }
            
            // 输出到控制台
            process.stdout.write(data);
        });

        child.stderr.on('data', (data) => {
            const message = data.toString();
            process.stderr.write(`${colors.red}${message}${colors.reset}`);
        });

        child.on('error', (error) => {
            log(`启动${serverConfig.name}失败: ${error.message}`, 'red', serverConfig.name);
            reject(error);
        });

        child.on('exit', (code) => {
            if (code !== 0) {
                log(`${serverConfig.name}异常退出 (代码: ${code})`, 'red', serverConfig.name);
            }
        });

        // 超时处理
        setTimeout(() => {
            if (!started) {
                log(`${serverConfig.name}启动超时`, 'yellow', serverConfig.name);
                child.kill();
                reject(new Error('启动超时'));
            }
        }, 10000);
    });
}

async function main() {
    log('🚀 非遗文化传承智能体助手 - 服务器启动器', 'bright');
    log('==========================================', 'cyan');
    
    const modularMode = process.env.RESOURCE_SERVER_MODULAR === 'true';
    log(`📦 资源服务器模式: ${modularMode ? '模块化' : '传统'}`, 'yellow');
    log(`📝 资源服务器脚本: ${config.resourceServer.script}`, 'yellow');
    log('==========================================', 'cyan');

    try {
        // 启动资源服务器
        const resourceServer = await startServer(config.resourceServer);
        
        // 等待一秒确保资源服务器完全启动
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 启动主服务器
        const mainServer = await startServer(config.mainServer);
        
        log('✅ 所有服务器启动成功！', 'green');
        log('🌐 主服务器: http://localhost:3000', 'cyan');
        log('🔧 资源服务器: http://localhost:3001', 'cyan');
        log('📖 前端界面: http://localhost:3000/index.html', 'cyan');
        log('==========================================', 'cyan');
        log('按 Ctrl+C 停止所有服务器', 'yellow');

        // 优雅关闭
        process.on('SIGINT', () => {
            log('正在关闭服务器...', 'yellow');
            mainServer.kill();
            resourceServer.kill();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            log('正在关闭服务器...', 'yellow');
            mainServer.kill();
            resourceServer.kill();
            process.exit(0);
        });

    } catch (error) {
        log(`❌ 启动失败: ${error.message}`, 'red');
        process.exit(1);
    }
}

// 运行启动器
main();
