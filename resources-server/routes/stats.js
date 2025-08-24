const express = require('express');
const router = express.Router();
const { promises: fsPromises } = require('fs');
const path = require('path');
const resourceService = require('../services/resourceService');
const config = require('../config/config');

// 获取资源统计信息
router.get('/stats', async (req, res) => {
    try {
        const resourcesDir = config.paths.resources;
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
        const knowledgeDir = config.paths.knowledge;
        if (require('fs').existsSync(knowledgeDir)) {
            const categories = await fsPromises.readdir(knowledgeDir);
            stats.totalCategories = categories.length;
            
            for (const category of categories) {
                const categoryPath = path.join(knowledgeDir, category);
                const stat = await fsPromises.stat(categoryPath);
                
                if (stat.isDirectory()) {
                    const dataFile = path.join(categoryPath, 'data.json');
                    if (require('fs').existsSync(dataFile)) {
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
                                    resourceService.analyzeResource(resource, stats, categoryStats, oneWeekAgo, oneMonthAgo, oneYearAgo);
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
                                        resourceService.analyzeResource(resource, stats, categoryStats, oneWeekAgo, oneMonthAgo, oneYearAgo);
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
            
            if (require('fs').existsSync(dataFile)) {
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

module.exports = router;
