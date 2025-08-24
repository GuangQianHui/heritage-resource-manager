const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const { promises: fsPromises } = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false
}));

// 压缩中间件
app.use(compression());

// 速率限制 - 调整为更宽松的设置
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 500, // 限制每个IP 15分钟内最多500个请求（从100增加到500）
    message: {
        error: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true, // 返回标准的速率限制头
    legacyHeaders: false, // 不返回旧的速率限制头
    skipSuccessfulRequests: true, // 成功的请求不计入限制
    skipFailedRequests: false // 失败的请求计入限制
});

// 为不同的API端点设置不同的限制
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 严格限制的端点
    message: {
        error: '操作过于频繁，请稍后再试'
    }
});

// 应用限制
app.use('/api/resources/batch', strictLimiter); // 批量操作使用严格限制
app.use('/api/', limiter); // 其他API使用宽松限制

// CORS配置
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000', 'http://127.0.0.1:8080', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'If-Modified-Since', 'If-None-Match']
}));

// 解析中间件
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// 额外的CORS处理
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, If-Modified-Since, If-None-Match');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// 静态文件服务 - 添加CORS头
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

// 处理静态文件的OPTIONS请求 - 必须在静态文件路由之前
app.options('/resources/*', (req, res) => {
    console.log('处理OPTIONS请求:', req.url);
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, If-Modified-Since, If-None-Match');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Last-Modified, ETag');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.sendStatus(200);
});

app.use(express.static(path.join(__dirname, 'resources'), staticOptions));

// 专门的静态文件路由
app.use('/resources', express.static(path.join(__dirname, 'resources'), staticOptions));
app.use('/resources/images', express.static(path.join(__dirname, 'resources', 'images'), staticOptions));
app.use('/resources/videos', express.static(path.join(__dirname, 'resources', 'videos'), staticOptions));
app.use('/resources/audio', express.static(path.join(__dirname, 'resources', 'audio'), staticOptions));
app.use('/resources/documents', express.static(path.join(__dirname, 'resources', 'documents'), staticOptions));
app.use('/resources/knowledge', express.static(path.join(__dirname, 'resources', 'knowledge'), staticOptions));

// 文件上传配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadDir = 'resources/';
        
        const fileType = file.mimetype || '';
        const fileName = file.originalname || '';
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExtension)) {
            uploadDir = 'resources/images/';
        } else if (fileType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(fileExtension)) {
            uploadDir = 'resources/videos/';
        } else if (fileType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(fileExtension)) {
            uploadDir = 'resources/audio/';
        } else if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(fileExtension)) {
            uploadDir = 'resources/documents/';
        }
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const originalName = file.originalname || 'file';
        const extension = originalName.split('.').pop() || '';
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
        const maxLength = 50;
        const truncatedName = cleanName.length > maxLength ? cleanName.substring(0, maxLength) : cleanName;
        const filename = `${timestamp}_${truncatedName}.${extension}`;
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
            'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/mkv', 'video/webm',
            'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/rtf', 'application/vnd.oasis.opendocument.text'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'), false);
        }
    }
});

// 资源数据结构
let resourceLibrary = {};

// 加载资源库
async function loadResourceLibrary() {
    try {
        const knowledgeDir = path.join(__dirname, 'resources', 'knowledge');
        if (!fs.existsSync(knowledgeDir)) {
            console.log('知识库目录不存在，创建默认结构...');
            fs.mkdirSync(knowledgeDir, { recursive: true });
            return;
        }

        const categories = await fsPromises.readdir(knowledgeDir);
        
        for (const category of categories) {
            const categoryPath = path.join(knowledgeDir, category);
            const stat = await fsPromises.stat(categoryPath);
            
            if (stat.isDirectory()) {
                const dataFile = path.join(categoryPath, 'data.json');
                if (fs.existsSync(dataFile)) {
                    try {
                        const data = await fsPromises.readFile(dataFile, 'utf8');
                        const parsedData = JSON.parse(data);
                        
                        // 统一转换为对象格式（以ID为键）
                        if (Array.isArray(parsedData)) {
                            // 如果是数组，转换为对象格式
                            resourceLibrary[category] = {};
                            parsedData.forEach(resource => {
                                if (resource && resource.id) {
                                    resourceLibrary[category][resource.id] = resource;
                                }
                            });
                        } else if (parsedData.resources && typeof parsedData.resources === 'object') {
                            // 如果包含resources字段，使用resources
                            resourceLibrary[category] = parsedData.resources;
                        } else {
                            // 否则使用整个数据对象
                            resourceLibrary[category] = parsedData;
                        }
                        
                        const resourceCount = resourceLibrary[category] ? Object.keys(resourceLibrary[category]).length : 0;
                        console.log(`加载分类 ${category}: ${resourceCount} 个资源`);
                    } catch (error) {
                        console.error(`解析 ${category} 数据失败:`, error);
                        resourceLibrary[category] = [];
                    }
                } else {
                    resourceLibrary[category] = [];
                }
            }
        }
        
        console.log('资源库加载完成');
    } catch (error) {
        console.error('加载资源库失败:', error);
    }
}

// 保存资源库
async function saveResourceLibrary() {
    try {
        const knowledgeDir = path.join(__dirname, 'resources', 'knowledge');
        if (!fs.existsSync(knowledgeDir)) {
            fs.mkdirSync(knowledgeDir, { recursive: true });
        }

        for (const [category, resources] of Object.entries(resourceLibrary)) {
            const categoryDir = path.join(knowledgeDir, category);
            if (!fs.existsSync(categoryDir)) {
                fs.mkdirSync(categoryDir, { recursive: true });
            }
            
            const dataFile = path.join(categoryDir, 'data.json');
            await fsPromises.writeFile(dataFile, JSON.stringify(resources, null, 2), 'utf8');
        }
        
        console.log('资源库保存完成');
    } catch (error) {
        console.error('保存资源库失败:', error);
        throw error;
    }
}

// API路由

// 服务器状态检查
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        message: '资源服务器运行正常',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 获取所有分类
app.get('/api/categories', (req, res) => {
    try {
        const categories = {
            traditionalFoods: { name: '传统美食', icon: 'fa-utensils', color: '#DC143C' },
            traditionalCrafts: { name: '传统工艺', icon: 'fa-gem', color: '#FFD700' },
            traditionalOpera: { name: '传统戏曲', icon: 'fa-mask', color: '#8B4513' },
            traditionalFestivals: { name: '传统节日', icon: 'fa-calendar', color: '#FF6B35' },
            traditionalMedicine: { name: '传统医药', icon: 'fa-leaf', color: '#228B22' },
            traditionalArchitecture: { name: '传统建筑', icon: 'fa-building', color: '#696969' }
        };
        
        res.json({
            success: true,
            categories: categories,
            count: Object.keys(categories).length
        });
    } catch (error) {
        console.error('获取分类失败:', error);
        res.status(500).json({
            success: false,
            error: '获取分类失败'
        });
    }
});

// 获取所有资源（支持分页/搜索/排序），并返回按ID键的对象结构
app.get('/api/resources/load-all', async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 12, 1);
        const sortBy = (req.query.sortBy || 'updatedAt').toString();
        const sortOrder = (req.query.sortOrder || 'desc').toString().toLowerCase();
        const categoryFilter = (req.query.category || '').toString().trim();
        const search = (req.query.search || '').toString().trim().toLowerCase();
        
        // 添加调试信息
        console.log(`排序参数: sortBy=${sortBy}, sortOrder=${sortOrder}, categoryFilter=${categoryFilter}, search=${search}`);

        // 收集所有资源到数组（可按分类过滤）
        let all = [];
        for (const [category, resources] of Object.entries(resourceLibrary)) {
            if (categoryFilter && category !== categoryFilter) continue;

            // 确保resources是数组格式
            let resourceArray = [];
            if (Array.isArray(resources)) {
                resourceArray = resources;
            } else if (typeof resources === 'object' && resources !== null) {
                // 如果是对象格式，转换为数组
                resourceArray = Object.values(resources);
            }

            // 追加分类字段，确保存在id
            for (const r of resourceArray) {
                if (!r) continue;
                const withMeta = { 
                    ...r, 
                    category: r.category || category,
                    id: r.id || r._id || r.title || Math.random().toString(36).slice(2)
                };
                all.push(withMeta);
            }
        }

        // 关键字搜索（标题/描述/内容/标签/关键词）
        if (search) {
            all = all.filter(r => {
                const text = [
                    r.title,
                    r.description,
                    r.content,
                    Array.isArray(r.tags) ? r.tags.join(' ') : '',
                    Array.isArray(r.keywords) ? r.keywords.join(' ') : ''
                ].join(' ').toLowerCase();
                return text.includes(search);
            });
        }

        // 排序
        const getVal = (r) => {
            if (sortBy === 'title') return (r.title || '').toString().toLowerCase();
            if (sortBy === 'createdAt') return new Date(r.createdAt || 0).getTime();
            // 默认按 updatedAt
            return new Date(r.updatedAt || 0).getTime();
        };
        
        // 添加排序调试信息
        if (sortBy === 'title') {
            console.log(`开始按标题排序，排序方向: ${sortOrder}`);
            console.log('排序前前5个标题:', all.slice(0, 5).map(r => r.title));
        }
        
        all.sort((a, b) => {
            const va = getVal(a);
            const vb = getVal(b);
            if (va === vb) return 0;
            const cmp = va > vb ? 1 : -1;
            return sortOrder === 'asc' ? cmp : -cmp;
        });
        
        // 添加排序后调试信息
        if (sortBy === 'title') {
            console.log('排序后前5个标题:', all.slice(0, 5).map(r => r.title));
        }

        // 分页
        const totalItems = all.length;
        const totalPages = Math.max(Math.ceil(totalItems / limit), 1);
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        const pageItems = all.slice(start, end);

        // 组装为 按分类 -> 以资源ID为键 的对象结构（仅返回当前页）
        // 保持排序后的顺序，按分类分组但保持排序
        const resourcesByCategory = {};
        for (const r of pageItems) {
            const cat = r.category || 'unknown';
            const id = r.id || (r._id || r.title || Math.random().toString(36).slice(2));
            if (!resourcesByCategory[cat]) resourcesByCategory[cat] = {};
            // 去除category重复字段，但保留id
            const { category, ...rest } = r;
            resourcesByCategory[cat][id] = {
                ...rest,
                id: id // 确保id字段存在
            };
        }
        
        // 添加调试信息，显示每个分类中的资源顺序
        if (sortBy === 'title') {
            console.log('按分类组织的资源:');
            for (const [category, resources] of Object.entries(resourcesByCategory)) {
                console.log(`${category}:`, Object.keys(resources).slice(0, 3)); // 显示前3个
            }
        }

        console.log(`加载资源请求 - 时间戳: ${Date.now()}, 分类: ${categoryFilter || 'null'}, 搜索: ${search || 'null'}`);
        console.log(`处理了 ${totalItems} 个资源，分页后显示 ${pageItems.length} 个`);

        return res.json({
            success: true,
            resources: resourcesByCategory,
            pagination: {
                currentPage,
                itemsPerPage: limit,
                totalItems,
                totalPages,
                hasPrevPage: currentPage > 1,
                hasNextPage: currentPage < totalPages
            }
        });
    } catch (error) {
        console.error('获取所有资源失败:', error);
        res.status(500).json({
            success: false,
            error: '获取资源失败'
        });
    }
});

// 获取所有资源（用于搜索，不分页）
app.get('/api/resources/search-all', async (req, res) => {
    try {
        console.log('搜索请求 - 获取所有资源数据');
        
        // 收集所有资源到数组
        let all = [];
        for (const [category, resources] of Object.entries(resourceLibrary)) {
            // 确保resources是数组格式
            let resourceArray = [];
            if (Array.isArray(resources)) {
                resourceArray = resources;
            } else if (typeof resources === 'object' && resources !== null) {
                // 如果是对象格式，转换为数组
                resourceArray = Object.values(resources);
            }

            // 追加分类字段，确保存在id
            for (const r of resourceArray) {
                if (!r) continue;
                const withMeta = { 
                    ...r, 
                    category: r.category || category,
                    id: r.id || r._id || r.title || Math.random().toString(36).slice(2)
                };
                all.push(withMeta);
            }
        }

        // 组装为 按分类 -> 以资源ID为键 的对象结构
        const resourcesByCategory = {};
        for (const r of all) {
            const cat = r.category || 'unknown';
            const id = r.id || (r._id || r.title || Math.random().toString(36).slice(2));
            if (!resourcesByCategory[cat]) resourcesByCategory[cat] = {};
            // 去除category重复字段，但保留id
            const { category, ...rest } = r;
            resourcesByCategory[cat][id] = {
                ...rest,
                id: id // 确保id字段存在
            };
        }

        console.log(`搜索资源请求 - 总资源数: ${all.length}`);

        return res.json({
            success: true,
            resources: resourcesByCategory,
            totalCount: all.length
        });
    } catch (error) {
        console.error('获取搜索资源失败:', error);
        res.status(500).json({
            success: false,
            error: '获取搜索资源失败'
        });
    }
});

// 获取资源统计信息
app.get('/api/resources/stats', async (req, res) => {
    try {
        const resourcesDir = path.join(__dirname, 'resources');
        const stats = {
            // 基础统计
            totalCategories: 0,
            totalResources: 0,
            totalMedia: 0,
            totalFileSize: 0,
            
            // 资源使用统计
            resourceUsage: {
                withMedia: 0,           // 有媒体文件的资源数
                withoutMedia: 0,        // 无媒体文件的资源数
                recentlyUpdated: 0,     // 最近7天更新的资源数
                recentlyCreated: 0,     // 最近7天创建的资源数
                highQuality: 0,         // 高质量资源数（有完整描述、历史、技法等）
                incomplete: 0           // 不完整资源数
            },
            
            // 内容质量统计
            contentQuality: {
                withHistory: 0,         // 有历史信息的资源数
                withTechnique: 0,       // 有技法信息的资源数
                withFeatures: 0,        // 有特色描述的资源数
                withFunFact: 0,         // 有趣闻的资源数
                withTags: 0,            // 有标签的资源数
                withKeywords: 0         // 有关键词的资源数
            },
            
            // 热门标签统计
            popularTags: {},
            popularKeywords: {},
            
            // 分类统计
            categories: {},
            fileTypes: {},
            mediaFiles: {
                images: 0,
                videos: 0,
                audio: 0,
                documents: 0
            },
            
            // 时间分布统计
            timeDistribution: {
                thisWeek: 0,
                thisMonth: 0,
                thisYear: 0,
                older: 0
            }
        };

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        // 统计知识库资源
        const knowledgeDir = path.join(resourcesDir, 'knowledge');
        if (fs.existsSync(knowledgeDir)) {
            const categories = await fsPromises.readdir(knowledgeDir);
            stats.totalCategories = categories.length;
            
            for (const category of categories) {
                const categoryPath = path.join(knowledgeDir, category);
                const stat = await fsPromises.stat(categoryPath);
                
                if (stat.isDirectory()) {
                    const dataFile = path.join(categoryPath, 'data.json');
                    if (fs.existsSync(dataFile)) {
                        try {
                            const data = await fsPromises.readFile(dataFile, 'utf8');
                            const parsedData = JSON.parse(data);
                            
                            let resourceCount = 0;
                            let mediaCount = 0;
                            let categoryTotalSize = 0;
                            let lastUpdated = null;
                            let categoryStats = {
                                resourceCount: 0,
                                mediaCount: 0,
                                totalSize: 0,
                                withMedia: 0,
                                withoutMedia: 0,
                                highQuality: 0,
                                incomplete: 0,
                                lastUpdated: null
                            };
                            
                            // 计算资源数量和使用情况
                            if (Array.isArray(parsedData)) {
                                resourceCount = parsedData.length;
                                parsedData.forEach(resource => {
                                    analyzeResource(resource, stats, categoryStats, oneWeekAgo, oneMonthAgo, oneYearAgo);
                                    if (resource.media && Array.isArray(resource.media)) {
                                        mediaCount += resource.media.length;
                                        // 计算该资源的媒体文件总大小
                                        resource.media.forEach(mediaFile => {
                                            if (mediaFile.size && mediaFile.size > 0) {
                                                categoryTotalSize += mediaFile.size;
                                            }
                                        });
                                        if (resource.media.length > 0) {
                                            categoryStats.withMedia++;
                                        } else {
                                            categoryStats.withoutMedia++;
                                        }
                                    } else {
                                        categoryStats.withoutMedia++;
                                    }
                                    if (resource.updatedAt && (!lastUpdated || resource.updatedAt > lastUpdated)) {
                                        lastUpdated = resource.updatedAt;
                                    }
                                });
                            } else if (typeof parsedData === 'object') {
                                const resources = parsedData.resources || parsedData;
                                if (typeof resources === 'object') {
                                    resourceCount = Object.keys(resources).length;
                                    Object.values(resources).forEach(resource => {
                                        analyzeResource(resource, stats, categoryStats, oneWeekAgo, oneMonthAgo, oneYearAgo);
                                        if (resource.media && Array.isArray(resource.media)) {
                                            mediaCount += resource.media.length;
                                            // 计算该资源的媒体文件总大小
                                            resource.media.forEach(mediaFile => {
                                                if (mediaFile.size && mediaFile.size > 0) {
                                                    categoryTotalSize += mediaFile.size;
                                                }
                                            });
                                            if (resource.media.length > 0) {
                                                categoryStats.withMedia++;
                                            } else {
                                                categoryStats.withoutMedia++;
                                            }
                                        } else {
                                            categoryStats.withoutMedia++;
                                        }
                                        if (resource.updatedAt && (!lastUpdated || resource.updatedAt > lastUpdated)) {
                                            lastUpdated = resource.updatedAt;
                                        }
                                    });
                                }
                            }
                            
                            stats.totalResources += resourceCount;
                            categoryStats.resourceCount = resourceCount;
                            categoryStats.mediaCount = mediaCount;
                            categoryStats.totalSize = categoryTotalSize;
                            categoryStats.lastUpdated = lastUpdated;
                            stats.categories[category] = categoryStats;
                        } catch (error) {
                            console.error(`解析 ${category} 统计失败:`, error);
                            stats.categories[category] = {
                                resourceCount: 0,
                                mediaCount: 0,
                                totalSize: 0,
                                withMedia: 0,
                                withoutMedia: 0,
                                highQuality: 0,
                                incomplete: 0,
                                lastUpdated: null
                            };
                        }
                    }
                }
            }
        }

        // 统计资源实际使用的媒体文件
        const usedMediaStats = {
            images: 0,
            videos: 0,
            audio: 0,
            documents: 0,
            totalSize: 0,
            fileTypes: {}
        };

        // 从所有分类中统计实际使用的媒体文件
        for (const [category, categoryStats] of Object.entries(stats.categories)) {
            const categoryPath = path.join(knowledgeDir, category);
            const dataFile = path.join(categoryPath, 'data.json');
            
            if (fs.existsSync(dataFile)) {
                try {
                    const data = await fsPromises.readFile(dataFile, 'utf8');
                    const parsedData = JSON.parse(data);
                    
                    const resources = Array.isArray(parsedData) ? parsedData : 
                                   (parsedData.resources ? Object.values(parsedData.resources) : Object.values(parsedData));
                    
                    resources.forEach(resource => {
                        if (resource.media && Array.isArray(resource.media)) {
                            resource.media.forEach(mediaFile => {
                                // 统计媒体文件类型
                                if (mediaFile.type === 'image') {
                                    usedMediaStats.images++;
                                } else if (mediaFile.type === 'video') {
                                    usedMediaStats.videos++;
                                } else if (mediaFile.type === 'audio') {
                                    usedMediaStats.audio++;
                                } else if (mediaFile.type === 'document') {
                                    usedMediaStats.documents++;
                                }
                                
                                // 统计文件大小
                                if (mediaFile.size && mediaFile.size > 0) {
                                    usedMediaStats.totalSize += mediaFile.size;
                                }
                                
                                // 统计文件类型
                                if (mediaFile.name) {
                                    const ext = path.extname(mediaFile.name).toLowerCase();
                                    if (ext) {
                                        usedMediaStats.fileTypes[ext] = (usedMediaStats.fileTypes[ext] || 0) + 1;
                                    }
                                }
                            });
                        }
                    });
                } catch (error) {
                    console.error(`统计 ${category} 媒体文件失败:`, error);
                }
            }
        }

        // 更新统计信息
        stats.mediaFiles = usedMediaStats;
        stats.totalMedia = usedMediaStats.images + usedMediaStats.videos + usedMediaStats.audio + usedMediaStats.documents;
        stats.totalFileSize = usedMediaStats.totalSize;
        stats.fileTypes = usedMediaStats.fileTypes;
        
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        console.error('获取统计信息失败:', error);
        res.status(500).json({
            success: false,
            error: '获取统计信息失败'
        });
    }
});

// 分析单个资源的函数
function analyzeResource(resource, stats, categoryStats, oneWeekAgo, oneMonthAgo, oneYearAgo) {
    // 检查媒体文件
    if (resource.media && Array.isArray(resource.media) && resource.media.length > 0) {
        stats.resourceUsage.withMedia++;
    } else {
        stats.resourceUsage.withoutMedia++;
    }
    
    // 检查时间分布
    if (resource.updatedAt) {
        const updateTime = new Date(resource.updatedAt);
        if (updateTime >= oneWeekAgo) {
            stats.timeDistribution.thisWeek++;
            stats.resourceUsage.recentlyUpdated++;
        } else if (updateTime >= oneMonthAgo) {
            stats.timeDistribution.thisMonth++;
        } else if (updateTime >= oneYearAgo) {
            stats.timeDistribution.thisYear++;
        } else {
            stats.timeDistribution.older++;
        }
    }
    
    if (resource.createdAt) {
        const createTime = new Date(resource.createdAt);
        if (createTime >= oneWeekAgo) {
            stats.resourceUsage.recentlyCreated++;
        }
    }
    
    // 检查内容质量
    let qualityScore = 0;
    if (resource.history && resource.history.trim()) {
        stats.contentQuality.withHistory++;
        qualityScore++;
    }
    if (resource.technique && resource.technique.trim()) {
        stats.contentQuality.withTechnique++;
        qualityScore++;
    }
    if (resource.features && resource.features.trim()) {
        stats.contentQuality.withFeatures++;
        qualityScore++;
    }
    if (resource.funFact && resource.funFact.trim()) {
        stats.contentQuality.withFunFact++;
        qualityScore++;
    }
    if (resource.tags && Array.isArray(resource.tags) && resource.tags.length > 0) {
        stats.contentQuality.withTags++;
        qualityScore++;
        // 统计热门标签
        resource.tags.forEach(tag => {
            stats.popularTags[tag] = (stats.popularTags[tag] || 0) + 1;
        });
    }
    if (resource.keywords && Array.isArray(resource.keywords) && resource.keywords.length > 0) {
        stats.contentQuality.withKeywords++;
        qualityScore++;
        // 统计热门关键词
        resource.keywords.forEach(keyword => {
            stats.popularKeywords[keyword] = (stats.popularKeywords[keyword] || 0) + 1;
        });
    }
    
    // 判断资源质量
    if (qualityScore >= 4) {
        stats.resourceUsage.highQuality++;
        categoryStats.highQuality++;
    } else if (qualityScore <= 1) {
        stats.resourceUsage.incomplete++;
        categoryStats.incomplete++;
    }
}

// 获取特定分类的资源
app.get('/api/resources/:category', (req, res) => {
    try {
        const category = req.params.category;
        let resources = resourceLibrary[category] || [];
        
        // 确保resources是数组
        if (!Array.isArray(resources)) {
            if (typeof resources === 'object' && resources !== null) {
                resources = Object.values(resources);
            } else {
                resources = [];
            }
        }
        
        res.json({
            success: true,
            category: category,
            resources: resources,
            count: resources.length
        });
    } catch (error) {
        console.error('获取分类资源失败:', error);
        res.status(500).json({
            success: false,
            error: '获取分类资源失败'
        });
    }
});

// 获取特定资源
app.get('/api/resources/:category/:id', (req, res) => {
    try {
        const category = req.params.category;
        const resourceId = req.params.id;
        
        if (!resourceLibrary[category]) {
            return res.status(404).json({
                success: false,
                error: '分类不存在'
            });
        }
        
        // 确保是对象格式（以ID为键）
        if (Array.isArray(resourceLibrary[category])) {
            const arrayData = resourceLibrary[category];
            resourceLibrary[category] = {};
            arrayData.forEach((resource, index) => {
                resourceLibrary[category][resource.id || `item_${index}`] = resource;
            });
        }
        
        const resource = resourceLibrary[category][resourceId];
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }
        
        res.json({
            success: true,
            resource: resource
        });
    } catch (error) {
        console.error('获取资源失败:', error);
        res.status(500).json({
            success: false,
            error: '获取资源失败'
        });
    }
});

// 批量导出资源API - 必须在批量操作路由之前
app.post('/api/resources/export', async (req, res) => {
    try {
        const { resources, format = 'json', filename = 'exported_resources' } = req.body;
        
        if (!resources || !Array.isArray(resources) || resources.length === 0) {
            return res.status(400).json({
                success: false,
                error: '请提供要导出的资源列表'
            });
        }
        
        // 收集要导出的资源数据
        const exportData = [];
        const failedResources = [];
        
        for (const resourceRef of resources) {
            const { category, id } = resourceRef;
            
            if (!resourceLibrary[category] || !resourceLibrary[category][id]) {
                failedResources.push({
                    category,
                    id,
                    error: '资源不存在'
                });
                continue;
            }
            
            const resource = resourceLibrary[category][id];
            exportData.push(resource);
        }
        
        if (exportData.length === 0) {
            return res.status(400).json({
                success: false,
                error: '没有找到可导出的资源'
            });
        }
        
        let fileContent;
        let contentType;
        let fileExtension;
        
        switch (format.toLowerCase()) {
            case 'json':
                fileContent = JSON.stringify(exportData, null, 2);
                contentType = 'application/json';
                fileExtension = 'json';
                break;
                
            case 'csv':
                // 转换为CSV格式
                if (exportData.length > 0) {
                    const headers = Object.keys(exportData[0]).filter(key => 
                        typeof exportData[0][key] !== 'object' || exportData[0][key] === null
                    );
                    
                    const csvRows = [
                        headers.join(','),
                        ...exportData.map(resource => 
                            headers.map(header => {
                                const value = resource[header];
                                if (value === null || value === undefined) return '';
                                if (Array.isArray(value)) return `"${value.join('; ')}"`;
                                return `"${String(value).replace(/"/g, '""')}"`;
                            }).join(',')
                        )
                    ];
                    
                    fileContent = csvRows.join('\n');
                } else {
                    fileContent = '';
                }
                contentType = 'text/csv';
                fileExtension = 'csv';
                break;
                
            case 'txt':
                // 转换为纯文本格式
                fileContent = exportData.map(resource => {
                    const lines = [
                        `标题: ${resource.title || '未命名'}`,
                        `分类: ${resource.category || '未分类'}`,
                        `描述: ${resource.description || '无描述'}`,
                        `标签: ${Array.isArray(resource.tags) ? resource.tags.join(', ') : ''}`,
                        `创建时间: ${resource.createdAt || '未知'}`,
                        `更新时间: ${resource.updatedAt || '未知'}`,
                        '---'
                    ];
                    return lines.join('\n');
                }).join('\n\n');
                contentType = 'text/plain';
                fileExtension = 'txt';
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    error: '不支持的导出格式，支持: json, csv, txt'
                });
        }
        
        // 设置响应头
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const finalFilename = `${filename}_${timestamp}.${fileExtension}`;
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(fileContent, 'utf8'));
        
        // 直接返回文件内容
        res.send(fileContent);
        
    } catch (error) {
        console.error('导出资源失败:', error);
        res.status(500).json({
            success: false,
            error: '导出资源失败: ' + error.message
        });
    }
});

// 批量操作API - 必须在具体分类路由之前
app.post('/api/resources/batch', async (req, res) => {
    try {
        const { action, resources, options = {} } = req.body;
        
        if (!action || !resources || !Array.isArray(resources) || resources.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: '缺少必要参数：action（操作类型）和resources（资源列表）' 
            });
        }
        
        const results = {
            success: [],
            failed: [],
            total: resources.length
        };
        
        for (const resourceInfo of resources) {
            const { category, id } = resourceInfo;
            
            if (!category || !id) {
                results.failed.push({
                    category,
                    id,
                    error: '缺少分类或ID信息'
                });
                continue;
            }
            
            try {
                // 确保分类存在
                if (!resourceLibrary[category]) {
                    resourceLibrary[category] = {};
                }
                
                // 确保是对象格式（以ID为键）
                if (Array.isArray(resourceLibrary[category])) {
                    // 如果是数组，转换为对象格式
                    const arrayData = resourceLibrary[category];
                    resourceLibrary[category] = {};
                    arrayData.forEach((resource, index) => {
                        resourceLibrary[category][resource.id || `item_${index}`] = resource;
                    });
                }
                
                // 检查资源是否存在
                if (!resourceLibrary[category][id]) {
                    results.failed.push({
                        category,
                        id,
                        error: `资源 ${id} 不存在`
                    });
                    continue;
                }
                
                switch (action) {

                        
                    case 'delete':
                        // 删除资源
                        const resourceToDelete = resourceLibrary[category][id];
                        
                        // 删除相关的媒体文件
                        if (resourceToDelete.media && Array.isArray(resourceToDelete.media)) {
                            for (const mediaFile of resourceToDelete.media) {
                                if (mediaFile.url) {
                                    try {
                                        // 从URL中提取文件路径
                                        const urlPath = new URL(mediaFile.url).pathname;
                                        const filePath = path.join(__dirname, 'resources', urlPath.replace('/resources/', ''));
                                        
                                        // 检查文件是否存在并删除
                                        if (fs.existsSync(filePath)) {
                                            fs.unlinkSync(filePath);
                                            console.log(`已删除媒体文件: ${filePath}`);
                                        }
                                    } catch (fileError) {
                                        console.warn(`删除媒体文件失败: ${mediaFile.url}`, fileError);
                                    }
                                }
                            }
                        }
                        
                        // 删除主文件（如果存在）
                        if (resourceToDelete.filePath && fs.existsSync(resourceToDelete.filePath)) {
                            try {
                                fs.unlinkSync(resourceToDelete.filePath);
                                console.log(`已删除主文件: ${resourceToDelete.filePath}`);
                            } catch (fileError) {
                                console.warn(`删除主文件失败: ${resourceToDelete.filePath}`, fileError);
                            }
                        }
                        
                        delete resourceLibrary[category][id];
                        results.success.push({ category, id, action: 'deleted' });
                        break;
                        
                    case 'move':
                        // 移动资源到新分类
                        const targetCategory = options.targetCategory;
                        if (!targetCategory) {
                            results.failed.push({
                                category,
                                id,
                                error: '缺少目标分类'
                            });
                            continue;
                        }
                        
                        // 确保目标分类存在
                        if (!resourceLibrary[targetCategory]) {
                            resourceLibrary[targetCategory] = {};
                        }
                        
                        // 移动资源
                        const resourceToMove = resourceLibrary[category][id];
                        resourceLibrary[targetCategory][id] = {
                            ...resourceToMove,
                            category: targetCategory,
                            updatedAt: new Date().toISOString()
                        };
                        delete resourceLibrary[category][id];
                        results.success.push({ category, id, action: 'moved', targetCategory });
                        break;
                        
                    case 'update':
                        // 更新资源
                        const updates = options.updates || {};
                        if (Object.keys(updates).length === 0) {
                            results.failed.push({
                                category,
                                id,
                                error: '缺少更新数据'
                            });
                            continue;
                        }
                        
                        const resourceToUpdate = resourceLibrary[category][id];
                        resourceLibrary[category][id] = {
                            ...resourceToUpdate,
                            ...updates,
                            updatedAt: new Date().toISOString()
                        };
                        results.success.push({ category, id, action: 'updated' });
                        break;
                        
                    case 'tag':
                        // 添加标签
                        const newTags = options.tags || [];
                        if (newTags.length === 0) {
                            results.failed.push({
                                category,
                                id,
                                error: '缺少标签信息'
                            });
                            continue;
                        }
                        
                        const resourceToTag = resourceLibrary[category][id];
                        const existingTags = resourceToTag.tags || [];
                        const updatedTags = [...new Set([...existingTags, ...newTags])];
                        
                        resourceLibrary[category][id] = {
                            ...resourceToTag,
                            tags: updatedTags,
                            updatedAt: new Date().toISOString()
                        };
                        results.success.push({ category, id, action: 'tagged', tags: newTags });
                        break;
                        

                        
                    case 'export':
                        // 导出资源（返回资源数据）
                        const resourceToExport = resourceLibrary[category][id];
                        if (resourceToExport) {
                            results.success.push({ 
                                category, 
                                id, 
                                action: 'exported', 
                                data: resourceToExport 
                            });
                        } else {
                            results.failed.push({
                                category,
                                id,
                                error: '资源不存在'
                            });
                        }
                        break;
                        
                    default:
                        results.failed.push({
                            category,
                            id,
                            error: `不支持的操作类型: ${action}`
                        });
                }
                
            } catch (error) {
                results.failed.push({
                    category,
                    id,
                    error: error.message
                });
            }
        }
        
        // 保存更改
        if (results.success.length > 0) {
            await saveResourceLibrary();
        }
        
        res.json({
            success: true,
            action,
            results,
            summary: {
                total: results.total,
                success: results.success.length,
                failed: results.failed.length
            }
        });
        
    } catch (error) {
        console.error('批量操作失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '批量操作失败: ' + error.message 
        });
    }
});

// 通用文件上传API
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        // 根据文件类型确定URL路径
        const fileType = req.file.mimetype || '';
        const fileName = req.file.originalname || '';
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        let urlSubDir = 'images/';
        if (fileType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(fileExtension)) {
            urlSubDir = 'videos/';
        } else if (fileType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(fileExtension)) {
            urlSubDir = 'audio/';
        } else if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(fileExtension)) {
            urlSubDir = 'documents/';
        }
        
        // 生成完整的URL路径
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        const urlPath = `${baseUrl}/resources/${urlSubDir}${req.file.filename}`;
        
        console.log('文件上传成功:', {
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: req.file.path,
            urlPath: urlPath,
            fileType: fileType,
            fileExtension: fileExtension
        });
        
        res.json({
            success: true,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            url: urlPath,
            type: fileType,
            extension: fileExtension,
            path: req.file.path
        });
    } catch (error) {
        console.error('文件上传失败:', error);
        res.status(500).json({
            success: false,
            error: '文件上传失败: ' + error.message
        });
    }
});

// 上传文件到资源库
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { category, resourceId } = req.body;
        
        // 根据文件类型确定URL路径
        const fileType = req.file.mimetype || '';
        const fileName = req.file.originalname || '';
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        let urlSubDir = 'images/';
        let mediaType = 'image';
        if (fileType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(fileExtension)) {
            urlSubDir = 'videos/';
            mediaType = 'video';
        } else if (fileType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(fileExtension)) {
            urlSubDir = 'audio/';
            mediaType = 'audio';
        } else if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(fileExtension)) {
            urlSubDir = 'documents/';
            mediaType = 'document';
        }
        
        // 生成完整的URL路径
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        const urlPath = `${baseUrl}/resources/${urlSubDir}${req.file.filename}`;
        
        console.log('文件上传到资源库成功:', {
            filePath: req.file.path,
            urlPath: urlPath,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            fileType: fileType,
            fileExtension: fileExtension,
            category: category,
            resourceId: resourceId,
            mediaType: mediaType
        });
        
        res.json({
            success: true,
            file: {
                id: req.file.filename,
                name: req.file.originalname,
                type: mediaType,
                url: urlPath,
                size: req.file.size
            },
            filePath: urlPath,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error('文件上传失败:', error);
        res.status(500).json({ error: '文件上传失败: ' + error.message });
    }
});

// 添加媒体文件到现有资源
app.post('/api/resources/:category/:id/media', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const category = req.params.category;
        const resourceId = req.params.id;
        
        // 检查资源是否存在
        if (!resourceLibrary[category]) {
            return res.status(404).json({
                success: false,
                error: '分类不存在'
            });
        }
        
        // 确保是对象格式（以ID为键）
        if (Array.isArray(resourceLibrary[category])) {
            const arrayData = resourceLibrary[category];
            resourceLibrary[category] = {};
            arrayData.forEach((resource, index) => {
                resourceLibrary[category][resource.id || `item_${index}`] = resource;
            });
        }
        
        const resource = resourceLibrary[category][resourceId];
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }
        
        // 根据文件类型确定URL路径
        const fileType = req.file.mimetype || '';
        const fileName = req.file.originalname || '';
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        let urlSubDir = 'images/';
        let mediaType = 'image';
        
        // 优先根据文件扩展名判断类型
        if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(fileExtension)) {
            urlSubDir = 'videos/';
            mediaType = 'video';
        } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(fileExtension)) {
            urlSubDir = 'audio/';
            mediaType = 'audio';
        } else if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(fileExtension)) {
            urlSubDir = 'documents/';
            mediaType = 'document';
        } else if (fileType.startsWith('video/')) {
            urlSubDir = 'videos/';
            mediaType = 'video';
        } else if (fileType.startsWith('audio/')) {
            urlSubDir = 'audio/';
            mediaType = 'audio';
        } else if (fileType.startsWith('application/')) {
            urlSubDir = 'documents/';
            mediaType = 'document';
        }
        
        // 生成完整的URL路径
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        const urlPath = `${baseUrl}/resources/${urlSubDir}${req.file.filename}`;
        
        // 检查媒体文件限制
        const existingMedia = resource.media || [];
        
        // 如果是视频文件，检查是否已有视频
        if (mediaType === 'video') {
            const existingVideos = existingMedia.filter(m => m.type === 'video');
            if (existingVideos.length > 0) {
                // 删除刚上传的视频文件
                try {
                    fs.unlinkSync(req.file.path);
                    console.log(`删除重复视频文件: ${req.file.path}`);
                } catch (error) {
                    console.warn('删除文件失败:', error);
                }
                
                return res.status(400).json({
                    success: false,
                    error: '该资源已包含视频文件，不能上传更多视频。每个资源只能有一个视频文件。'
                });
            }
        }
        
        // 创建新的媒体文件对象
        const newMediaFile = {
            name: req.file.originalname,
            type: mediaType,
            size: req.file.size,
            url: urlPath
        };
        
        // 添加到资源的媒体列表中
        resource.media = existingMedia.concat([newMediaFile]);
        resource.updatedAt = new Date().toISOString();
        
        // 保存更改
        await saveResourceLibrary();
        
        console.log('媒体文件添加成功:', {
            category,
            resourceId,
            mediaFile: newMediaFile,
            totalMedia: resource.media.length
        });
        
        res.json({
            success: true,
            message: '媒体文件添加成功',
            mediaFile: newMediaFile,
            resource: resource
        });
        
    } catch (error) {
        console.error('添加媒体文件失败:', error);
        console.error('错误堆栈:', error.stack);
        res.status(500).json({
            success: false,
            error: '添加媒体文件失败: ' + error.message,
            details: error.stack
        });
    }
});

// 添加资源
app.post('/api/resources/:category', upload.single('file'), async (req, res) => {
    try {
        const category = req.params.category;
        const resourceData = req.body;
        
        // 确保分类存在且为数组
        if (!resourceLibrary[category]) {
            resourceLibrary[category] = [];
        } else if (!Array.isArray(resourceLibrary[category])) {
            // 如果不是数组，转换为数组
            if (typeof resourceLibrary[category] === 'object' && resourceLibrary[category] !== null) {
                resourceLibrary[category] = Object.values(resourceLibrary[category]);
            } else {
                resourceLibrary[category] = [];
            }
        }
        
        // 处理媒体文件信息
        let media = [];
        if (resourceData.media) {
            try {
                media = JSON.parse(resourceData.media);
                if (!Array.isArray(media)) {
                    media = [];
                }
            } catch (error) {
                console.warn('解析媒体文件信息失败:', error);
                media = [];
            }
        }
        
        // 如果有上传的文件，也添加到媒体列表中
        if (req.file) {
            const fileUrl = `/resources/${req.file.filename}`;
            const fileType = req.file.mimetype || '';
            let mediaType = 'document';
            if (fileType.startsWith('image/')) mediaType = 'image';
            else if (fileType.startsWith('video/')) mediaType = 'video';
            else if (fileType.startsWith('audio/')) mediaType = 'audio';
            
            media.push({
                name: req.file.originalname,
                type: mediaType,
                size: req.file.size,
                url: fileUrl
            });
        }
        
        const newResource = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            title: resourceData.title || '未命名资源',
            description: resourceData.description || '',
            category: category,
            tags: resourceData.tags ? resourceData.tags.split(',').map(tag => tag.trim()) : [],
            keywords: resourceData.keywords ? resourceData.keywords.split(',').map(keyword => keyword.trim()) : [],
            media: media,
            filePath: req.file ? req.file.path.replace(/\\/g, '/') : null,
            fileName: req.file ? req.file.filename : null,
            fileSize: req.file ? req.file.size : 0,
            mimeType: req.file ? req.file.mimetype : null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        resourceLibrary[category].push(newResource);
        await saveResourceLibrary();
        
        res.json({
            success: true,
            resource: newResource,
            message: '资源添加成功'
        });
    } catch (error) {
        console.error('添加资源失败:', error);
        res.status(500).json({
            success: false,
            error: '添加资源失败'
        });
    }
});

// 更新资源
app.put('/api/resources/:category/:id', upload.single('file'), async (req, res) => {
    try {
        const category = req.params.category;
        const resourceId = req.params.id;
        const updateData = req.body;
        
        if (!resourceLibrary[category]) {
            return res.status(404).json({
                success: false,
                error: '分类不存在'
            });
        }
        
        const resourceIndex = resourceLibrary[category].findIndex(r => r.id === resourceId);
        if (resourceIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }
        
        const updatedResource = {
            ...resourceLibrary[category][resourceIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        
        if (req.file) {
            updatedResource.filePath = req.file.path.replace(/\\/g, '/');
            updatedResource.fileName = req.file.filename;
            updatedResource.fileSize = req.file.size;
            updatedResource.mimeType = req.file.mimetype;
        }
        
        resourceLibrary[category][resourceIndex] = updatedResource;
        await saveResourceLibrary();
        
        res.json({
            success: true,
            resource: updatedResource,
            message: '资源更新成功'
        });
    } catch (error) {
        console.error('更新资源失败:', error);
        res.status(500).json({
            success: false,
            error: '更新资源失败'
        });
    }
});

// 删除媒体文件
app.delete('/api/resources/:category/:id/media/:mediaIndex', async (req, res) => {
    try {
        const category = req.params.category;
        const resourceId = req.params.id;
        const mediaIndex = parseInt(req.params.mediaIndex);
        
        // 检查资源是否存在
        if (!resourceLibrary[category]) {
            return res.status(404).json({
                success: false,
                error: '分类不存在'
            });
        }
        
        // 确保是对象格式（以ID为键）
        if (Array.isArray(resourceLibrary[category])) {
            const arrayData = resourceLibrary[category];
            resourceLibrary[category] = {};
            arrayData.forEach((resource, index) => {
                resourceLibrary[category][resource.id || `item_${index}`] = resource;
            });
        }
        
        const resource = resourceLibrary[category][resourceId];
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }
        
        const media = resource.media || [];
        if (mediaIndex < 0 || mediaIndex >= media.length) {
            return res.status(404).json({
                success: false,
                error: '媒体文件索引不存在'
            });
        }
        
        const mediaFile = media[mediaIndex];
        
        // 删除物理文件
        if (mediaFile.url) {
            try {
                // 从URL中提取文件路径
                const urlPath = new URL(mediaFile.url).pathname;
                const filePath = path.join(__dirname, 'resources', urlPath.replace('/resources/', ''));
                
                // 检查文件是否存在并删除
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`已删除媒体文件: ${filePath}`);
                }
            } catch (fileError) {
                console.warn(`删除媒体文件失败: ${mediaFile.url}`, fileError);
            }
        }
        
        // 从媒体列表中移除
        media.splice(mediaIndex, 1);
        resource.media = media;
        resource.updatedAt = new Date().toISOString();
        
        // 保存更改
        await saveResourceLibrary();
        
        console.log('媒体文件删除成功:', {
            category,
            resourceId,
            mediaIndex,
            remainingMedia: media.length
        });
        
        res.json({
            success: true,
            message: '媒体文件删除成功',
            remainingMedia: media
        });
        
    } catch (error) {
        console.error('删除媒体文件失败:', error);
        res.status(500).json({
            success: false,
            error: '删除媒体文件失败: ' + error.message
        });
    }
});

// 删除资源
app.delete('/api/resources/:category/:id', async (req, res) => {
    try {
        const category = req.params.category;
        const resourceId = req.params.id;
        
        if (!resourceLibrary[category]) {
            return res.status(404).json({
                success: false,
                error: '分类不存在'
            });
        }
        
        const resourceIndex = resourceLibrary[category].findIndex(r => r.id === resourceId);
        if (resourceIndex === -1) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }
        
        const deletedResource = resourceLibrary[category][resourceIndex];
        
        // 删除相关的媒体文件
        if (deletedResource.media && Array.isArray(deletedResource.media)) {
            for (const mediaFile of deletedResource.media) {
                if (mediaFile.url) {
                    try {
                        // 从URL中提取文件路径
                        const urlPath = new URL(mediaFile.url).pathname;
                        const filePath = path.join(__dirname, 'resources', urlPath.replace('/resources/', ''));
                        
                        // 检查文件是否存在并删除
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            console.log(`已删除媒体文件: ${filePath}`);
                        }
                    } catch (fileError) {
                        console.warn(`删除媒体文件失败: ${mediaFile.url}`, fileError);
                    }
                }
            }
        }
        
        // 删除主文件（如果存在）
        if (deletedResource.filePath && fs.existsSync(deletedResource.filePath)) {
            try {
                fs.unlinkSync(deletedResource.filePath);
                console.log(`已删除主文件: ${deletedResource.filePath}`);
            } catch (fileError) {
                console.warn(`删除主文件失败: ${deletedResource.filePath}`, fileError);
            }
        }
        
        resourceLibrary[category].splice(resourceIndex, 1);
        await saveResourceLibrary();
        
        res.json({
            success: true,
            message: '资源删除成功'
        });
    } catch (error) {
        console.error('删除资源失败:', error);
        res.status(500).json({
            success: false,
            error: '删除资源失败'
        });
    }
});



// 搜索资源
app.get('/api/resources/search', (req, res) => {
    try {
        const query = req.query.q || '';
        const category = req.query.category || '';
        const results = [];
        
        const searchCategories = category ? [category] : Object.keys(resourceLibrary);
        
        for (const cat of searchCategories) {
            if (resourceLibrary[cat]) {
                const categoryResults = resourceLibrary[cat].filter(resource => {
                    const searchText = `${resource.title} ${resource.description} ${resource.tags.join(' ')}`.toLowerCase();
                    return searchText.includes(query.toLowerCase());
                });
                
                results.push(...categoryResults.map(r => ({ ...r, category: cat })));
            }
        }
        
        res.json({
            success: true,
            results: results,
            count: results.length,
            query: query
        });
    } catch (error) {
        console.error('搜索资源失败:', error);
        res.status(500).json({
            success: false,
            error: '搜索资源失败'
        });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        success: false,
        error: '服务器内部错误'
    });
});

// 404处理 - 只对API路由返回JSON错误，静态文件路由保持默认行为
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        error: '接口不存在'
    });
});

// Socket.IO事件处理
io.on('connection', (socket) => {
    console.log('客户端连接:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('客户端断开连接:', socket.id);
    });
    
    socket.on('resource-updated', (data) => {
        socket.broadcast.emit('resource-updated', data);
    });
    
    socket.on('resource-added', (data) => {
        socket.broadcast.emit('resource-added', data);
    });
    
    socket.on('resource-deleted', (data) => {
        socket.broadcast.emit('resource-deleted', data);
    });
});

// 启动服务器
const PORT = process.env.PORT || 3001;

async function startServer() {
    try {
        await loadResourceLibrary();
        
        server.listen(PORT, () => {
            console.log(`资源服务器运行在端口 ${PORT}`);
            console.log(`API地址: http://localhost:${PORT}/api`);
            console.log(`静态文件: http://localhost:${PORT}/resources`);
        });
    } catch (error) {
        console.error('启动服务器失败:', error);
        process.exit(1);
    }
}

startServer();
