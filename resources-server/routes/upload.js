const express = require('express');
const router = express.Router();
const { upload, getFileType, generateFileUrl } = require('../utils/fileUpload');

// 通用文件上传API
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const fileType = getFileType(req.file);
        const urlPath = generateFileUrl(req.file, fileType);
        
        console.log('文件上传成功:', {
            originalName: req.file.originalname,
            filename: req.file.filename,
            path: req.file.path,
            urlPath: urlPath,
            fileType: req.file.mimetype,
            fileExtension: req.file.originalname.split('.').pop().toLowerCase()
        });
        
        res.json({
            success: true,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            url: urlPath,
            type: req.file.mimetype,
            extension: req.file.originalname.split('.').pop().toLowerCase(),
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
router.post('/upload-file', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const { category, resourceId } = req.body;
        const mediaType = getFileType(req.file);
        const urlPath = generateFileUrl(req.file, mediaType);
        
        console.log('文件上传到资源库成功:', {
            filePath: req.file.path,
            urlPath: urlPath,
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            fileType: req.file.mimetype,
            fileExtension: req.file.originalname.split('.').pop().toLowerCase(),
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

module.exports = router;
