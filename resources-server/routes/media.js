const express = require('express');
const router = express.Router();
const { upload, getFileType, generateFileUrl } = require('../utils/fileUpload');
const resourceService = require('../services/resourceService');
const config = require('../config/config');
const fs = require('fs');
const path = require('path'); // Added missing import for path

// 添加媒体文件到现有资源
router.post('/:category/:id/media', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const category = req.params.category;
        const resourceId = req.params.id;
        
        const resource = resourceService.getResource(category, resourceId);
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }
        
        const mediaType = getFileType(req.file);
        const urlPath = generateFileUrl(req.file, mediaType);
        
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
        await resourceService.saveResourceLibrary();
        
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

// 删除媒体文件
router.delete('/:category/:id/media/:mediaIndex', async (req, res) => {
    try {
        const category = req.params.category;
        const resourceId = req.params.id;
        const mediaIndex = parseInt(req.params.mediaIndex);
        
        const resource = resourceService.getResource(category, resourceId);
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
                const filePath = path.join(config.paths.resources, urlPath.replace('/resources/', ''));
                
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
        await resourceService.saveResourceLibrary();
        
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

module.exports = router;
