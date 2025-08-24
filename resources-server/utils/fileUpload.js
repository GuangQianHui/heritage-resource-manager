const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// 文件存储配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadDir = config.paths.resources + '/';
        
        const fileType = file.mimetype || '';
        const fileName = file.originalname || '';
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        if (fileType.startsWith('image/') || config.fileTypeMapping.images.includes(fileExtension)) {
            uploadDir = config.paths.images + '/';
        } else if (fileType.startsWith('video/') || config.fileTypeMapping.videos.includes(fileExtension)) {
            uploadDir = config.paths.videos + '/';
        } else if (fileType.startsWith('audio/') || config.fileTypeMapping.audio.includes(fileExtension)) {
            uploadDir = config.paths.audio + '/';
        } else if (config.fileTypeMapping.documents.includes(fileExtension)) {
            uploadDir = config.paths.documents + '/';
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

// 文件过滤器
const fileFilter = function (req, file, cb) {
    if (config.upload.allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型'), false);
    }
};

// 创建multer实例
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: config.upload.maxFileSize
    },
    fileFilter: fileFilter
});

// 获取文件类型
const getFileType = (file) => {
    const fileType = file.mimetype || '';
    const fileName = file.originalname || '';
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    if (fileType.startsWith('image/') || config.fileTypeMapping.images.includes(fileExtension)) {
        return 'image';
    } else if (fileType.startsWith('video/') || config.fileTypeMapping.videos.includes(fileExtension)) {
        return 'video';
    } else if (fileType.startsWith('audio/') || config.fileTypeMapping.audio.includes(fileExtension)) {
        return 'audio';
    } else if (config.fileTypeMapping.documents.includes(fileExtension)) {
        return 'document';
    }
    
    return 'document';
};

// 获取URL子目录
const getUrlSubDir = (fileType) => {
    switch (fileType) {
        case 'image': return 'images/';
        case 'video': return 'videos/';
        case 'audio': return 'audio/';
        case 'document': return 'documents/';
        default: return 'documents/';
    }
};

// 生成文件URL
const generateFileUrl = (file, fileType) => {
    const urlSubDir = getUrlSubDir(fileType);
    const baseUrl = config.server.baseUrl;
    return `${baseUrl}/resources/${urlSubDir}${file.filename}`;
};

module.exports = {
    upload,
    getFileType,
    getUrlSubDir,
    generateFileUrl
};
