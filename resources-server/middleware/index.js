const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('../config/config');

// 安全中间件
const securityMiddleware = helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
});

// 压缩中间件
const compressionMiddleware = compression();

// 速率限制中间件
const rateLimitMiddleware = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        error: '请求过于频繁，请稍后再试'
    }
});

// CORS中间件
const corsMiddleware = cors(config.cors);

// 解析中间件
const bodyParserMiddleware = [
    bodyParser.json({ limit: '50mb' }),
    bodyParser.urlencoded({ extended: true, limit: '50mb' })
];

// 额外的CORS处理中间件
const additionalCorsMiddleware = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, If-Modified-Since, If-None-Match');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
};

// 静态文件服务配置
const staticOptions = {
    setHeaders: (res, path, stat) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, If-Modified-Since, If-None-Match');
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        res.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
        res.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Last-Modified, ETag');
    }
};

// 错误处理中间件
const errorHandler = (error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
};

// 404处理中间件
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: '接口不存在'
    });
};

module.exports = {
    securityMiddleware,
    compressionMiddleware,
    rateLimitMiddleware,
    corsMiddleware,
    bodyParserMiddleware,
    additionalCorsMiddleware,
    staticOptions,
    errorHandler,
    notFoundHandler
};
