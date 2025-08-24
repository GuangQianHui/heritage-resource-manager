const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const { promises: fsPromises } = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 修复路径问题
app.use(express.static(path.join(__dirname)));

// 添加专门的静态文件路由，处理uploads目录
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 资源服务器代理：将资源相关请求转发到独立资源服务器(端口3001)
const RESOURCE_SERVER_URL = process.env.RESOURCE_SERVER_URL || 'http://localhost:3001';

// 支持模块化资源服务器的配置
const RESOURCE_SERVER_MODULAR = process.env.RESOURCE_SERVER_MODULAR === 'true' || false;
const RESOURCE_SERVER_SCRIPT = RESOURCE_SERVER_MODULAR ? 'server-modular.js' : 'server.js';

// 兼容统计接口命名差异：/api/resources/statistics -> /api/resources/stats
// 注意：这个路由需要在通用代理之后定义，避免冲突

// 手动代理 /api/resources/* 到资源服务器
app.use('/api/resources', async (req, res, next) => {
    try {
        // 修复路径问题：移除重复的 /api/resources 前缀
        const path = req.originalUrl.replace('/api/resources', '');
        const target = `${RESOURCE_SERVER_URL}/api/resources${path}`;
        console.log(`代理API请求: ${req.method} ${req.originalUrl} -> ${target}`);
        console.log(`路径处理: originalUrl=${req.originalUrl}, path=${path}, target=${target}`);
        console.log(`代理API请求: ${req.method} ${req.originalUrl} -> ${target}`);
        
        const options = {
            method: req.method,
            headers: { ...req.headers }
        };
        
        // 移除可能导致问题的头部
        delete options.headers.host;
        delete options.headers.connection;
        
        // 处理请求体
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
                // 对于 multipart/form-data，直接转发原始请求
                console.log('处理 multipart/form-data 请求');
                options.body = req;
                options.duplex = 'half';
            } else {
                // 对于其他类型，序列化请求体
                options.body = JSON.stringify(req.body || {});
                options.headers['content-type'] = 'application/json';
            }
        }
        
        const response = await fetch(target, options);
        const contentType = response.headers.get('content-type') || 'application/json';
        
        res.status(response.status);
        res.setHeader('content-type', contentType);
        
        if (contentType.includes('application/json')) {
            const data = await response.json();
            return res.json(data);
        } else {
            // 对于非JSON响应，使用流式传输
            response.body.pipe(res);
        }
    } catch (error) {
        console.error('API代理失败:', error);
        res.status(502).json({ 
            success: false, 
            error: '资源服务器连接失败',
            details: error.message 
        });
    }
});

// 代理静态资源 /resources/* 到资源服务器，保证媒体文件可访问
app.use('/resources', async (req, res, next) => {
    try {
        // 确保URL正确编码
        const encodedUrl = encodeURI(req.originalUrl);
        const target = `${RESOURCE_SERVER_URL}${encodedUrl}`;
        console.log(`代理静态资源: ${req.originalUrl} -> ${target}`);
        
        const r = await fetch(target, {
            method: 'GET',
            headers: {
                'Accept': '*/*',
                'User-Agent': 'Resource-Proxy/1.0'
            }
        });
        
        if (!r.ok) {
            console.error(`静态资源代理失败: ${r.status} ${r.statusText} - ${target}`);
            return res.status(r.status).end(`静态资源代理失败: ${r.statusText}`);
        }
        
        // 设置响应头
        const contentType = r.headers.get('content-type') || 'application/octet-stream';
        const contentLength = r.headers.get('content-length');
        const etag = r.headers.get('etag');
        const lastModified = r.headers.get('last-modified');
        
        res.status(r.status);
        res.setHeader('content-type', contentType);
        if (contentLength) {
            res.setHeader('content-length', contentLength);
        }
        if (etag) {
            res.setHeader('etag', etag);
        }
        if (lastModified) {
            res.setHeader('last-modified', lastModified);
        }
        
        // 添加CORS头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, If-Range, If-Modified-Since, If-None-Match');
        
        // 使用更安全的方式传输数据
        const arrayBuffer = await r.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.send(buffer);
        
        console.log(`静态资源代理成功: ${req.originalUrl} (${buffer.length} bytes)`);
        
    } catch (e) {
        console.error('静态资源代理失败:', e);
        return res.status(502).end('静态资源代理失败');
    }
});

// 添加文件存在性检查的中间件
app.use('/uploads/*', (req, res, next) => {
    const filePath = path.join(__dirname, 'uploads', req.params[0]);
    if (!fs.existsSync(filePath)) {
        console.warn(`文件不存在: ${filePath}`);
        // 尝试在resources目录中查找
        const resourcePath = path.join(__dirname, 'resources-server', 'resources', req.params[0]);
        if (fs.existsSync(resourcePath)) {
            console.log(`在resources目录中找到文件: ${resourcePath}`);
            req.url = `/resources/${req.params[0]}`;
        }
    }
    next();
});

// 文件上传配置 - 所有媒体文件统一保存到资源服务器
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // 所有媒体文件都保存到资源服务器的临时目录，然后通过API传输
        let uploadDir = 'uploads/';
        
        // 检查文件类型
        const fileType = file.mimetype || '';
        const fileName = file.originalname || '';
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        // 确保临时上传目录存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 生成更好的文件名格式，避免乱码
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const originalName = file.originalname || 'file';
        const extension = originalName.split('.').pop() || '';
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        
        // 清理文件名，移除特殊字符，只保留字母、数字、中文、下划线和连字符
        const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
        
        // 限制文件名长度
        const maxLength = 50;
        const truncatedName = cleanName.length > maxLength ? cleanName.substring(0, maxLength) : cleanName;
        
        const filename = `${timestamp}_${truncatedName}.${extension}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

// 创建上传目录

// 创建必要的目录 - 只保留临时上传目录
const directories = [
    'uploads'
];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// API路由

// 1. 获取应用状态
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: ['voice-recognition', 'ai-assistant', 'media-display']
    });
});

// 2. 语音识别API（模拟）
app.post('/api/speech/recognize', (req, res) => {
    const { audioData, language = 'zh-CN' } = req.body;
    
    // 这里可以集成真实的语音识别服务
    // 目前返回模拟结果
    setTimeout(() => {
        res.json({
            success: true,
            text: '这是模拟的语音识别结果',
            confidence: 0.95,
            language: language
        });
    }, 1000);
});

// 3. 文本转语音API
app.post('/api/speech/synthesize', (req, res) => {
    const { text, voice = 'female', rate = 1.0, pitch = 1.0 } = req.body;
    
    // 这里可以集成真实的TTS服务
    res.json({
        success: true,
        audioUrl: '/api/audio/generated',
        duration: text.length * 0.1,
        voice: voice
    });
});

// 4. 文件上传API - 直接保存到资源服务器目录
app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有文件上传' });
    }
    
    try {
        // 根据文件类型确定目标目录
        const fileType = req.file.mimetype || '';
        const fileName = req.file.originalname || '';
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        let targetSubDir = 'documents/';
        if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExtension)) {
            targetSubDir = 'images/';
        } else if (fileType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(fileExtension)) {
            targetSubDir = 'videos/';
        } else if (fileType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(fileExtension)) {
            targetSubDir = 'audio/';
        }
        
        // 确保目标目录存在
        const targetDir = path.join(__dirname, 'resources-server', 'resources', targetSubDir);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // 移动文件到资源服务器目录
        const targetPath = path.join(targetDir, req.file.filename);
        fs.copyFileSync(req.file.path, targetPath);
        
        // 删除临时文件
        fs.unlinkSync(req.file.path);
        
        // 生成完整的资源服务器URL
        const urlPath = `${RESOURCE_SERVER_URL}/resources/${targetSubDir}${req.file.filename}`;
        
        console.log('文件已保存到资源服务器:', {
            originalName: req.file.originalname,
            filename: req.file.filename,
            targetPath: targetPath,
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
            path: targetPath
        });
    } catch (error) {
        console.error('文件上传失败:', error);
        
        // 清理临时文件
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            error: '文件上传失败: ' + error.message
        });
    }
});

// 5. 媒体扫描API
app.get('/api/scan-media', (req, res) => {
    const fs = require('fs');
    const { path: scanPath } = req.query;
    
    if (!scanPath) {
        return res.status(400).json({ error: '缺少path参数' });
    }
    
    const fullPath = path.join(__dirname, scanPath);
    
    try {
        if (!fs.existsSync(fullPath)) {
            return res.json([]);
        }
        
        const files = fs.readdirSync(fullPath).map(filename => {
            const filePath = path.join(fullPath, filename);
            const stats = fs.statSync(filePath);
            
            return {
                name: filename,
                size: stats.size,
                lastModified: stats.mtime,
                isDirectory: stats.isDirectory()
            };
        }).filter(file => !file.isDirectory);
        
        res.json(files);
    } catch (error) {
        console.error('扫描媒体目录失败:', error);
        res.status(500).json({ error: '扫描失败' });
    }
});

// 6. 知识库API
app.get('/api/knowledge/:category', (req, res) => {
    const fs = require('fs');
    const { category } = req.params;
    
    const knowledgePath = path.join(__dirname, 'resources-server', 'resources', 'knowledge', category, 'data.json');
    
    try {
        if (!fs.existsSync(knowledgePath)) {
            return res.status(404).json({ error: '知识库不存在' });
        }
        
        const data = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
        res.json(data);
    } catch (error) {
        console.error('读取知识库失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

// 7. 媒体资源API
app.get('/api/media', (req, res) => {
    const mediaList = [
        {
            id: 1,
            type: 'image',
            title: '传统文化',
            url: '/images/902d71300a7f1ac3efbb4308cffa5e8.jpg',
            description: '传统建筑风格'
        },
        {
            id: 2,
            type: 'video',
            title: '非遗文化展示',
            url: '/videos/86dbe096dc22e52439b60423ad83e419.mp4',
            description: '传统文化视频'
        }
    ];
    
    res.json(mediaList);
});

// 6. AI对话API - 智能媒体查找
app.post('/api/chat', async (req, res) => {
    const { message, context = [] } = req.body;
    
    try {
        // 解析用户请求中的关键词
        const keywords = extractKeywords(message);
        console.log('解析到的关键词:', keywords);
        
        // 在资源库中查找相关资源
        const foundResources = await findResourcesByKeywords(keywords);
        console.log('找到的资源:', foundResources);
        
        // 生成智能回复
        const response = generateSmartResponse(message, foundResources);
        
        res.json({
            success: true,
            response: response.response,
            media: response.media,
            resources: response.resources,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('AI对话处理失败:', error);
        res.status(500).json({
            success: false,
            error: '处理请求失败: ' + error.message
        });
    }
});

// 提取关键词函数
function extractKeywords(message) {
    // 先尝试完整匹配（保留原始输入）
    const originalKeywords = [message];
    
    // 然后进行分词处理
    let cleanMsg = message.replace(/[，。！？、,.!\-]/g, ' ');
    const stopWords = ['的', '了', '和', '与', '请', '我要', '给我', '图片', '照片', '视频', '相关', '看看', '看'];
    let words = cleanMsg.split(/\s+/).filter(Boolean);
    words = words.filter(w => !stopWords.includes(w) && w.length > 1); // 过滤单字符
    
    // 合并原始输入和分词结果，去重
    const allKeywords = [...originalKeywords, ...words];
    const uniqueKeywords = [...new Set(allKeywords)];
    
    return uniqueKeywords;
}

// 根据关键词查找资源
async function findResourcesByKeywords(keywords) {
    const foundResources = [];
    try {
        const knowledgeDir = path.join(__dirname, 'resources-server', 'resources', 'knowledge');
        if (fs.existsSync(knowledgeDir)) {
            const categories = fs.readdirSync(knowledgeDir);
            for (const category of categories) {
                const categoryPath = path.join(knowledgeDir, category);
                if (fs.statSync(categoryPath).isDirectory()) {
                    const dataFilePath = path.join(categoryPath, 'data.json');
                    if (fs.existsSync(dataFilePath)) {
                        try {
                            const dataContent = await fsPromises.readFile(dataFilePath, 'utf8');
                            const categoryData = JSON.parse(dataContent);
                            if (categoryData.resources) {
                                for (const [id, resource] of Object.entries(categoryData.resources)) {
                                    // 归一化所有可检索字段
                                    const fields = [
                                        resource.title, resource.description,
                                        ...(resource.tags || []),
                                        ...(resource.keywords || [])
                                    ].filter(Boolean);
                                    
                                    // 计算匹配分数
                                    let matchScore = 0;
                                    let bestMatch = '';
                                    let exactTitleMatch = false;
                                    
                                    for (const ukey of keywords) {
                                        // 优先检查标题完全匹配
                                        if (resource.title === ukey) {
                                            matchScore += 20;
                                            bestMatch = resource.title;
                                            exactTitleMatch = true;
                                            break; // 标题完全匹配就直接返回
                                        }
                                        
                                        // 检查关键词完全匹配
                                        if (resource.keywords && resource.keywords.includes(ukey)) {
                                            matchScore += 15;
                                            bestMatch = ukey;
                                        }
                                        
                                        // 检查其他字段的包含匹配
                                        for (const field of fields) {
                                            if (field.includes(ukey) || ukey.includes(field)) {
                                                matchScore += 5;
                                                if (!bestMatch) bestMatch = field;
                                            }
                                        }
                                    }
                                    
                                    // 只有匹配分数大于等于10才认为是有效匹配
                                    const isMatch = matchScore >= 10;
                                    if (isMatch) {
                                        foundResources.push({
                                            ...resource,
                                            category: category,
                                            id: id,
                                            matchScore: matchScore,
                                            bestMatch: bestMatch,
                                            exactTitleMatch: exactTitleMatch
                                        });
                                    }
                                }
                            }
                        } catch (readError) {
                            console.error(`读取分类 ${category} 数据失败:`, readError);
                        }
                    }
                }
            }
        }
        // 按匹配分数排序，分数高的排在前面
        foundResources.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        
        // 如果匹配分数相同，优先返回标题完全匹配的
        foundResources.sort((a, b) => {
            if (a.matchScore === b.matchScore) {
                if (a.exactTitleMatch && !b.exactTitleMatch) return -1;
                if (!a.exactTitleMatch && b.exactTitleMatch) return 1;
            }
            return 0;
        });
        
        // 只返回匹配分数最高的前3个结果，避免返回过多不相关结果
        const topResults = foundResources.slice(0, 3);
        
        // 如果最高分数明显高于其他分数（差距大于5），只返回最高分的
        if (topResults.length > 1 && topResults[0].matchScore - topResults[1].matchScore > 5) {
            return [topResults[0]];
        }
        
        return topResults;
    } catch (error) {
        console.error('查找资源失败:', error);
        return [];
    }
}

// 生成智能回复
function generateSmartResponse(message, foundResources) {
    let response = '';
    let media = [];
    let resources = [];
    
    // 智能媒体类型检测
    const isVideoRequest = message.includes('视频') || message.includes('影片') || message.includes('录像') || message.includes('动态');
    const isImageRequest = message.includes('照片') || message.includes('图片') || message.includes('图') || message.includes('静态');
    const isMediaRequest = isVideoRequest || isImageRequest || message.includes('生成');
    
    // 情感分析
    const isCurious = message.includes('好奇') || message.includes('想知道') || message.includes('想了解') || message.includes('想探索');
    const isExcited = message.includes('兴奋') || message.includes('激动') || message.includes('热情') || message.includes('期待');
    const isSurprised = message.includes('惊讶') || message.includes('惊奇') || message.includes('没想到') || message.includes('意外');
    const isConfused = message.includes('困惑') || message.includes('疑惑') || message.includes('不明白') || message.includes('不懂');
    
    if (foundResources.length > 0) {
        // 找到匹配的资源
        resources = foundResources;
        const resource = foundResources[0];
        const resourceName = resource.title || resource.name || '这个传统文化项目';
        
        // 分析用户查询的方面
        let aspect = '详细信息';
        if (message.includes('做法') || message.includes('制作') || message.includes('工艺')) {
            aspect = '做法';
        } else if (message.includes('历史') || message.includes('起源')) {
            aspect = '历史';
        } else if (message.includes('特点') || message.includes('特色')) {
            aspect = '特点';
        } else if (message.includes('文化') || message.includes('内涵')) {
            aspect = '文化';
        } else if (message.includes('传承') || message.includes('保护')) {
            aspect = '传承';
        } else if (message.includes('价值') || message.includes('意义')) {
            aspect = '价值';
        } else if (message.includes('发展') || message.includes('创新')) {
            aspect = '发展';
        }
        
        // 获取主要内容
        let mainContent = '';
        switch (aspect) {
            case '历史':
                mainContent = resource.history || resource.content || '历史悠久，传承至今。';
                break;
            case '做法':
                mainContent = resource.technique || resource.content || '制作工艺精湛，需要丰富的经验。';
                break;
            case '特点':
                mainContent = resource.features || resource.content || '具有独特的文化特色和艺术价值。';
                break;
            case '文化':
                mainContent = resource.content || resource.history || '承载着深厚的文化内涵。';
                break;
            case '传承':
                mainContent = resource.content || resource.history || '需要一代代人的努力来保护和传承。';
                break;
            case '价值':
                mainContent = `${resourceName}具有很高的艺术价值和文化价值，${resource.content || resource.history || '是中华文化的重要组成部分。'}`;
                break;
            case '发展':
                mainContent = `${resourceName}的发展历程很有意思，${resource.history || resource.content || '见证了中华文化的发展。'}`;
                break;
            default:
                mainContent = resource.content || resource.history || resource.technique || resource.features || '是中华传统文化的重要组成部分。';
        }
        
        // 根据情感状态生成不同的回复开头
        let responseStarter = '';
        if (isCurious) {
            const curiousStarters = [
                '哈哈，您的好奇心让我很开心！让我来为您详细介绍一下...',
                '您的好奇心让我很感动！让我来为您揭秘这个有趣的内容...',
                '您的好奇心让我很欣赏！让我来为您详细介绍这个精彩内容...'
            ];
            responseStarter = curiousStarters[Math.floor(Math.random() * curiousStarters.length)];
        } else if (isExcited) {
            const excitedStarters = [
                '您的热情感染了我！让我来为您分享这个精彩内容...',
                '您的兴奋让我很开心！让我来为您介绍这个有趣的内容...',
                '您的热情让我很感动！让我来为您详细讲解这个精彩内容...'
            ];
            responseStarter = excitedStarters[Math.floor(Math.random() * excitedStarters.length)];
        } else if (isSurprised) {
            const surprisedStarters = [
                '哈哈，您的反应让我很满意！这确实很有趣，让我来为您详细介绍...',
                '您的惊讶让我很开心！这确实很有意思，让我来为您分享更多内容...',
                '您的反应让我很欣慰！这确实很有趣，让我来为您详细讲解...'
            ];
            responseStarter = surprisedStarters[Math.floor(Math.random() * surprisedStarters.length)];
        } else if (isConfused) {
            const confusedStarters = [
                '我理解您的困惑，让我来为您详细解释一下，保证让您明白...',
                '您的困惑我理解，让我来为您详细说明，保证让您清楚...',
                '我明白您的疑惑，让我来为您详细讲解，保证让您理解...'
            ];
            responseStarter = confusedStarters[Math.floor(Math.random() * confusedStarters.length)];
        } else {
            const normalStarters = [
                `很高兴为您介绍「${resourceName}」的${aspect}！`,
                `让我来为您详细介绍一下「${resourceName}」的${aspect}。`,
                `关于「${resourceName}」的${aspect}，这里有很多精彩的内容。`,
                `「${resourceName}」的${aspect}很有意思，让我来为您分享。`,
                `我很乐意为您介绍「${resourceName}」的${aspect}！`
            ];
            responseStarter = normalStarters[Math.floor(Math.random() * normalStarters.length)];
        }
        
        // 生成温度化回复
        response = `${responseStarter}\n\n${mainContent}`;
        
        // 有趣小知识
        if (resource.funFact) {
            response += `\n\n💡 有趣小知识：${resource.funFact}`;
        }
        
        // 添加关键词信息
        if (resource.keywords && resource.keywords.length > 0) {
            response += `\n\n🏷️ 相关标签：${resource.keywords.join('、')}`;
        }
        
        // 智能媒体文件过滤和收集
        if (isMediaRequest) {
            let allMedia = [];
            for (const resource of foundResources) {
                if (resource.media && resource.media.length > 0) {
                    allMedia.push(...resource.media);
                }
            }
            
            // 根据用户请求类型过滤媒体文件
            if (isVideoRequest) {
                // 只提供视频文件
                media = allMedia.filter(mediaItem => 
                    mediaItem.type === 'video' || 
                    mediaItem.url.includes('.mp4') || 
                    mediaItem.url.includes('.avi') || 
                    mediaItem.url.includes('.mov') || 
                    mediaItem.url.includes('.wmv') || 
                    mediaItem.url.includes('.flv') || 
                    mediaItem.url.includes('.mkv') || 
                    mediaItem.url.includes('.webm')
                );
                
                if (media.length > 0) {
                    response += `\n\n🎬 特地为您准备了相关视频，点击下方链接观看：`;
                    media.forEach(mediaItem => {
                        response += `\n👉 <a href="${mediaItem.url}" target="_blank">${mediaItem.name || '观看视频'}</a>`;
                    });
                } else {
                    response += `\n\n😊 抱歉，当前没有找到相关的视频文件，但您可以查看其他媒体内容。`;
                }
            } else if (isImageRequest) {
                // 只提供图片文件
                media = allMedia.filter(mediaItem => 
                    mediaItem.type === 'image' || 
                    mediaItem.url.includes('.jpg') || 
                    mediaItem.url.includes('.jpeg') || 
                    mediaItem.url.includes('.png') || 
                    mediaItem.url.includes('.gif') || 
                    mediaItem.url.includes('.webp') || 
                    mediaItem.url.includes('.bmp') || 
                    mediaItem.url.includes('.svg')
                );
            
                if (media.length > 0) {
                    response += `\n\n🖼️ 特地为您准备了相关图片，点击下方链接欣赏：`;
                    media.forEach(mediaItem => {
                        response += `\n👉 <a href="${mediaItem.url}" target="_blank">${mediaItem.name || '查看图片'}</a>`;
                    });
                } else {
                    response += `\n\n😊 抱歉，当前没有找到相关的图片文件，但您可以查看其他媒体内容。`;
                }
            } else {
                // 默认提供所有媒体文件
                media = allMedia;
                if (media.length > 0) {
                    response += `\n\n📸 顺便为您准备了相关媒体，点击下方链接欣赏：`;
                    media.forEach(mediaItem => {
                        const isVideo = mediaItem.type === 'video' || 
                                       mediaItem.url.includes('.mp4') || 
                                       mediaItem.url.includes('.avi') || 
                                       mediaItem.url.includes('.mov') || 
                                       mediaItem.url.includes('.wmv') || 
                                       mediaItem.url.includes('.flv') || 
                                       mediaItem.url.includes('.mkv') || 
                                       mediaItem.url.includes('.webm');
                        
                        const icon = isVideo ? '🎬' : '🖼️';
                        const text = isVideo ? '观看视频' : '查看图片';
                        response += `\n${icon} <a href="${mediaItem.url}" target="_blank">${mediaItem.name || text}</a>`;
                    });
                }
            }
        }
        
        // 个性化结尾互动
        const responseEnders = [
            `\n\n您对${resourceName}还有什么想了解的吗？我很乐意为您详细介绍！`,
            `\n\n如果您想了解更多关于${resourceName}的内容，随时告诉我！`,
            `\n\n希望这个介绍让您满意！还有什么其他传统文化想了解的吗？`,
            `\n\n这就是${resourceName}的精彩内容！您还想了解其他传统文化吗？`,
            `\n\n感谢您的关注！如果您对${resourceName}还有其他问题，我很乐意为您解答！`,
            `\n\n很高兴为您服务！如果您对${resourceName}还有其他疑问，随时告诉我！`,
            `\n\n希望这个介绍对您有帮助！还有什么其他传统文化想了解的吗？`
        ];
        
        const ender = responseEnders[Math.floor(Math.random() * responseEnders.length)];
        response += ender;
        
    } else {
        // 没有找到匹配的资源 - 更友好的回复
        const noResultStarters = [
            '😊 抱歉，我暂时无法为您找到相关的内容。',
            '🤔 抱歉，我暂时没有找到您询问的内容。',
            '😅 抱歉，我暂时无法为您提供相关信息。',
            '🙏 抱歉，我暂时没有找到您想了解的内容。',
            '😌 抱歉，我暂时无法为您生成相关的内容。'
        ];
        
        const starter = noResultStarters[Math.floor(Math.random() * noResultStarters.length)];
        
        if (isVideoRequest) {
            response = `${starter}不过我的知识库正在不断丰富中，您可以尝试询问其他传统文化内容！`;
        } else if (isImageRequest) {
            response = `${starter}不过我的知识库正在不断丰富中，您可以尝试询问其他传统文化内容！`;
        } else if (isMediaRequest) {
            response = `${starter}不过我的知识库正在不断丰富中，您可以尝试询问其他传统文化内容！`;
        } else {
            response = `${starter}不过我的知识库正在不断丰富中，您可以尝试询问其他传统文化内容！`;
        }
        
        // 添加建议
        response += `\n\n💡 建议您可以尝试询问：北京烤鸭、麻婆豆腐、景泰蓝、京剧等传统文化项目。`;
    }
    
    return {
        response: response,
        media: media,
        resources: resources
    };
}

// 7. 资源库文件系统API

// 保存资源分类
app.post('/api/save-resource-category', async (req, res) => {
    try {
        const { category, name, resources, lastUpdated } = req.body;
        
        // 创建分类目录 - 修正路径到资源服务器
        const categoryDir = path.join(__dirname, 'resources-server', 'resources', 'knowledge', category);
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }
        
        // 保存分类数据
        const categoryData = {
            category,
            name,
            resources,
            lastUpdated,
            metadata: {
                totalResources: Object.keys(resources).length,
                createdAt: new Date().toISOString(),
                updatedAt: lastUpdated
            }
        };
        
        const filePath = path.join(categoryDir, 'data.json');
        await fsPromises.writeFile(filePath, JSON.stringify(categoryData, null, 2));
        
        res.json({
            success: true,
            message: `分类 ${category} 保存成功`,
            filePath: filePath,
            savedAt: new Date().toISOString(),
            resourceCount: Object.keys(resources).length
        });
    } catch (error) {
        console.error('保存资源分类失败:', error);
        res.status(500).json({ error: '保存失败: ' + error.message });
    }
});

// 上传文件到资源库 - 转发到资源服务器
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { category, resourceId } = req.body;
        
        try {
            // 创建FormData对象，将文件转发到资源服务器
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', fs.createReadStream(req.file.path), {
                filename: req.file.originalname,
                contentType: req.file.mimetype
            });
            
            // 添加其他参数
            if (category) form.append('category', category);
            if (resourceId) form.append('resourceId', resourceId);
            
            // 发送到资源服务器
            const response = await fetch(`${RESOURCE_SERVER_URL}/api/upload-file`, {
                method: 'POST',
                body: form,
                headers: form.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`资源服务器响应错误: ${response.status}`);
            }
            
            const result = await response.json();
            
            // 删除临时文件
            fs.unlinkSync(req.file.path);
            
            console.log('文件已转发到资源服务器:', result);
            
            res.json(result);
        } catch (error) {
            // 清理临时文件
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            throw error;
        }
    } catch (error) {
        console.error('文件上传失败:', error);
        res.status(500).json({ error: '文件上传失败: ' + error.message });
    }
});

// 删除文件
app.post('/api/delete-file', async (req, res) => {
    try {
        const { filePath } = req.body;
        
        // 构建完整的文件路径
        const fullPath = path.join(__dirname, filePath.replace(/^\//, ''));
        
        if (fs.existsSync(fullPath)) {
            await fsPromises.unlink(fullPath);
            res.json({
                success: true,
                message: '文件删除成功'
            });
        } else {
            res.status(404).json({ error: '文件不存在' });
        }
    } catch (error) {
        console.error('删除文件失败:', error);
        res.status(500).json({ error: '删除文件失败: ' + error.message });
    }
});

// 文件路径修复API - 处理错误的文件路径
app.get('/api/fix-file-path', async (req, res) => {
    try {
        const { originalPath } = req.query;
        
        if (!originalPath) {
            return res.status(400).json({ error: '缺少文件路径参数' });
        }
        
        console.log('尝试修复文件路径:', originalPath);
        
        // 尝试在不同的目录中查找文件
        const possiblePaths = [
            path.join(__dirname, originalPath.replace(/^\//, '')),
            path.join(__dirname, 'uploads', originalPath.split('/').pop())
        ];
        
        for (const filePath of possiblePaths) {
            if (fs.existsSync(filePath)) {
                console.log('找到文件:', filePath);
                
                // 生成正确的URL路径 - 所有文件都应该通过资源服务器访问
                let correctUrl = '';
                if (filePath.includes('uploads')) {
                    // 临时文件，应该通过资源服务器重新上传
                    correctUrl = `/uploads/${path.basename(filePath)}`;
                } else {
                    // 其他情况，保持原路径
                    correctUrl = originalPath;
                }
                
                return res.json({
                    success: true,
                    originalPath: originalPath,
                    correctPath: correctUrl,
                    fileExists: true
                });
            }
        }
        
        // 如果找不到文件，返回错误
        console.warn('文件不存在:', originalPath);
        res.json({
            success: false,
            originalPath: originalPath,
            fileExists: false,
            message: '文件不存在'
        });
        
    } catch (error) {
        console.error('修复文件路径失败:', error);
        res.status(500).json({ error: '修复文件路径失败: ' + error.message });
    }
});

// 获取资源库结构
app.get('/api/resources/structure', async (req, res) => {
    try {
        const resourcesDir = path.join(__dirname, 'resources-server', 'resources');
        const structure = {};
        
        if (fs.existsSync(resourcesDir)) {
            const categories = fs.readdirSync(resourcesDir);
            
            for (const category of categories) {
                const categoryPath = path.join(resourcesDir, category);
                if (fs.statSync(categoryPath).isDirectory()) {
                    structure[category] = {
                        path: category,
                        files: fs.readdirSync(categoryPath)
                    };
                }
            }
        }
        
        res.json({
            success: true,
            structure: structure
        });
    } catch (error) {
        console.error('获取资源库结构失败:', error);
        res.status(500).json({ error: '获取结构失败: ' + error.message });
    }
});

// 资源相关路由已通过代理转发到独立资源服务器

// 特定分类资源路由已通过代理转发到独立资源服务器

// 资源统计路由已通过代理转发到独立资源服务器

// 批量操作API已通过代理转发到独立资源服务器

// Socket.IO 实时通信
io.on('connection', (socket) => {
    console.log('用户已连接:', socket.id);
    
    // 处理语音识别结果
    socket.on('speech-result', (data) => {
        console.log('收到语音识别结果:', data);
        // 广播给其他客户端
        socket.broadcast.emit('speech-update', data);
    });
    
    // 处理AI回复
    socket.on('ai-response', (data) => {
        console.log('AI回复:', data);
        socket.broadcast.emit('ai-update', data);
    });
    
    // 处理媒体显示
    socket.on('media-display', (data) => {
        console.log('媒体显示:', data);
        socket.broadcast.emit('media-update', data);
    });
    
    socket.on('disconnect', () => {
        console.log('用户已断开连接:', socket.id);
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        error: '服务器内部错误',
        message: err.message
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        error: '接口不存在',
        path: req.path
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 主服务器已启动，访问地址: http://localhost:${PORT}`);
    console.log(`📁 静态文件服务: http://localhost:${PORT}/index.html`);
    console.log(`🔧 API文档: http://localhost:${PORT}/api/status`);
    console.log(`🔄 资源服务器代理: ${RESOURCE_SERVER_URL}`);
    console.log(`📦 资源服务器模式: ${RESOURCE_SERVER_MODULAR ? '模块化' : '传统'}`);
    console.log(`📝 资源服务器脚本: ${RESOURCE_SERVER_SCRIPT}`);
    console.log(`💡 提示: 使用 RESOURCE_SERVER_MODULAR=true 环境变量启用模块化资源服务器`);
}); 