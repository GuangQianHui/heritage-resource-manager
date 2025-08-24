const express = require('express');
const router = express.Router();
const resourceService = require('../services/resourceService');
const config = require('../config/config');
const fs = require('fs');
const path = require('path'); // Added missing import for path

// 批量导出资源API
router.post('/export', async (req, res) => {
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
            
            const resource = resourceService.getResource(category, id);
            if (!resource) {
                failedResources.push({
                    category,
                    id,
                    error: '资源不存在'
                });
                continue;
            }
            
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

// 批量操作API
router.post('/batch', async (req, res) => {
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
                // 检查资源是否存在
                const resource = resourceService.getResource(category, id);
                if (!resource) {
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
                        // 删除相关的媒体文件
                        if (resource.media && Array.isArray(resource.media)) {
                            for (const mediaFile of resource.media) {
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
                            }
                        }
                        
                        // 删除主文件（如果存在）
                        if (resource.filePath && fs.existsSync(resource.filePath)) {
                            try {
                                fs.unlinkSync(resource.filePath);
                                console.log(`已删除主文件: ${resource.filePath}`);
                            } catch (fileError) {
                                console.warn(`删除主文件失败: ${resource.filePath}`, fileError);
                            }
                        }
                        
                        resourceService.deleteResource(category, id);
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
                        
                        // 移动资源
                        const resourceToMove = resource;
                        resourceService.addResource(targetCategory, {
                            ...resourceToMove,
                            category: targetCategory,
                            updatedAt: new Date().toISOString()
                        });
                        resourceService.deleteResource(category, id);
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
                        
                        resourceService.updateResource(category, id, updates);
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
                        
                        const existingTags = resource.tags || [];
                        const updatedTags = [...new Set([...existingTags, ...newTags])];
                        
                        resourceService.updateResource(category, id, { tags: updatedTags });
                        results.success.push({ category, id, action: 'tagged', tags: newTags });
                        break;
                        
                    case 'export':
                        // 导出资源（返回资源数据）
                        results.success.push({ 
                            category, 
                            id, 
                            action: 'exported', 
                            data: resource 
                        });
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
            await resourceService.saveResourceLibrary();
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

module.exports = router;
