const path = require('path');

module.exports = {
    // 服务器配置
    server: {
        port: process.env.PORT || 3001,
        baseUrl: process.env.BASE_URL || 'http://localhost:3001'
    },

    // CORS配置
    cors: {
        origins: ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000', 'http://127.0.0.1:8080', 'http://localhost:3001'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'If-Modified-Since', 'If-None-Match']
    },

    // 速率限制配置
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15分钟
        max: 100 // 限制每个IP 15分钟内最多100个请求
    },

    // 文件上传配置
    upload: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedTypes: [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
            'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/mkv', 'video/webm',
            'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/rtf', 'application/vnd.oasis.opendocument.text'
        ]
    },

    // 资源分类配置
    categories: {
        traditionalFoods: { name: '传统美食', icon: 'fa-utensils', color: '#DC143C' },
        traditionalCrafts: { name: '传统工艺', icon: 'fa-gem', color: '#FFD700' },
        traditionalOpera: { name: '传统戏曲', icon: 'fa-mask', color: '#8B4513' },
        traditionalFestivals: { name: '传统节日', icon: 'fa-calendar', color: '#FF6B35' },
        traditionalMedicine: { name: '传统医药', icon: 'fa-leaf', color: '#228B22' },
        traditionalArchitecture: { name: '传统建筑', icon: 'fa-building', color: '#696969' }
    },

    // 路径配置
    paths: {
        resources: path.join(__dirname, '..', 'resources'),
        knowledge: path.join(__dirname, '..', 'resources', 'knowledge'),
        images: path.join(__dirname, '..', 'resources', 'images'),
        videos: path.join(__dirname, '..', 'resources', 'videos'),
        audio: path.join(__dirname, '..', 'resources', 'audio'),
        documents: path.join(__dirname, '..', 'resources', 'documents')
    },

    // 文件类型映射
    fileTypeMapping: {
        images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
        videos: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'],
        audio: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'],
        documents: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt']
    }
};
