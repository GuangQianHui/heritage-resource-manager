const express = require('express');
const router = express.Router();
const { upload, getFileType, generateFileUrl } = require('../utils/fileUpload');
const resourceService = require('../services/resourceService');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');

// 获取所有资源（支持分页/搜索/排序）
router.get('/load-all', async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 12, 1);
        const sortBy = (req.query.sortBy || 'updatedAt').toString();
        const sortOrder = (req.query.sortOrder || 'desc').toString().toLowerCase();
        const categoryFilter = (req.query.category || '').toString().trim();
        const search = (req.query.search || '').toString().trim().toLowerCase();
        
        const resourceLibrary = resourceService.getResourceLibrary();
        
        // 收集所有资源到数组（可按分类过滤）
        let all = [];
        for (const [category, resources] of Object.entries(resourceLibrary)) {
            if (categoryFilter && category !== categoryFilter) continue;

            // 确保resources是数组格式
            let resourceArray = [];
            if (Array.isArray(resources)) {
                resourceArray = resources;
            } else if (typeof resources === 'object' && resources !== null) {
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

        // 关键字搜索
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
            return new Date(r.updatedAt || 0).getTime();
        };
        
        all.sort((a, b) => {
            const va = getVal(a);
            const vb = getVal(b);
            if (va === vb) return 0;
            const cmp = va > vb ? 1 : -1;
            return sortOrder === 'asc' ? cmp : -cmp;
        });

        // 分页
        const totalItems = all.length;
        const totalPages = Math.max(Math.ceil(totalItems / limit), 1);
        const currentPage = Math.min(page, totalPages);
        const start = (currentPage - 1) * limit;
        const end = start + limit;
        const pageItems = all.slice(start, end);

        // 组装为按分类的对象结构
        const resourcesByCategory = {};
        for (const r of pageItems) {
            const cat = r.category || 'unknown';
            const id = r.id || (r._id || r.title || Math.random().toString(36).slice(2));
            if (!resourcesByCategory[cat]) resourcesByCategory[cat] = {};
            const { category, ...rest } = r;
            resourcesByCategory[cat][id] = {
                ...rest,
                id: id
            };
        }

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
router.get('/search-all', async (req, res) => {
    try {
        const resourceLibrary = resourceService.getResourceLibrary();
        
        // 收集所有资源到数组
        let all = [];
        for (const [category, resources] of Object.entries(resourceLibrary)) {
            let resourceArray = [];
            if (Array.isArray(resources)) {
                resourceArray = resources;
            } else if (typeof resources === 'object' && resources !== null) {
                resourceArray = Object.values(resources);
            }

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

        // 组装为按分类的对象结构
        const resourcesByCategory = {};
        for (const r of all) {
            const cat = r.category || 'unknown';
            const id = r.id || (r._id || r.title || Math.random().toString(36).slice(2));
            if (!resourcesByCategory[cat]) resourcesByCategory[cat] = {};
            const { category, ...rest } = r;
            resourcesByCategory[cat][id] = {
                ...rest,
                id: id
            };
        }

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

// 兼容性路由：处理 /api/resources/category/:category 请求
router.get('/category/:category', (req, res) => {
    try {
        const category = req.params.category;
        let resources = resourceService.getCategoryResources(category) || [];
        
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

// 获取特定分类的资源
router.get('/:category', (req, res) => {
    try {
        const category = req.params.category;
        let resources = resourceService.getCategoryResources(category) || [];
        
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
router.get('/:category/:id', (req, res) => {
    try {
        const category = req.params.category;
        const resourceId = req.params.id;
        
        const resource = resourceService.getResource(category, resourceId);
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

// 搜索资源
router.get('/search', (req, res) => {
    try {
        const query = req.query.q || '';
        const category = req.query.category || '';
        const results = [];
        
        const resourceLibrary = resourceService.getResourceLibrary();
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

// 添加资源
router.post('/:category', upload.single('file'), async (req, res) => {
    try {
        const category = req.params.category;
        const resourceData = req.body;
        
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
        
        resourceService.addResource(category, newResource);
        await resourceService.saveResourceLibrary();
        
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
router.put('/:category/:id', upload.single('file'), async (req, res) => {
    try {
        const category = req.params.category;
        const resourceId = req.params.id;
        const updateData = req.body;
        
        const resource = resourceService.getResource(category, resourceId);
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }
        
        const updatedResource = {
            ...resource,
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        
        if (req.file) {
            updatedResource.filePath = req.file.path.replace(/\\/g, '/');
            updatedResource.fileName = req.file.filename;
            updatedResource.fileSize = req.file.size;
            updatedResource.mimeType = req.file.mimetype;
        }
        
        resourceService.updateResource(category, resourceId, updatedResource);
        await resourceService.saveResourceLibrary();
        
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

// 删除资源
router.delete('/:category/:id', async (req, res) => {
    try {
        const category = req.params.category;
        const resourceId = req.params.id;
        
        const resource = resourceService.getResource(category, resourceId);
        if (!resource) {
            return res.status(404).json({
                success: false,
                error: '资源不存在'
            });
        }
        
        // 删除相关的媒体文件
        if (resource.media && Array.isArray(resource.media)) {
            for (const mediaFile of resource.media) {
                if (mediaFile.url) {
                    try {
                        const urlPath = new URL(mediaFile.url).pathname;
                        const filePath = path.join(config.paths.resources, urlPath.replace('/resources/', ''));
                        
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
        
        resourceService.deleteResource(category, resourceId);
        await resourceService.saveResourceLibrary();
        
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

module.exports = router;
