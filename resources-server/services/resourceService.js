const fs = require('fs');
const { promises: fsPromises } = require('fs');
const path = require('path');
const config = require('../config/config');

// 资源数据结构
let resourceLibrary = {};

// 加载资源库
async function loadResourceLibrary() {
    try {
        const knowledgeDir = config.paths.knowledge;
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
        const knowledgeDir = config.paths.knowledge;
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

// 获取资源库
function getResourceLibrary() {
    return resourceLibrary;
}

// 设置资源库
function setResourceLibrary(library) {
    resourceLibrary = library;
}

// 获取分类资源
function getCategoryResources(category) {
    return resourceLibrary[category] || {};
}

// 设置分类资源
function setCategoryResources(category, resources) {
    resourceLibrary[category] = resources;
}

// 获取特定资源
function getResource(category, id) {
    if (!resourceLibrary[category]) {
        return null;
    }
    
    // 确保是对象格式（以ID为键）
    if (Array.isArray(resourceLibrary[category])) {
        const arrayData = resourceLibrary[category];
        resourceLibrary[category] = {};
        arrayData.forEach((resource, index) => {
            resourceLibrary[category][resource.id || `item_${index}`] = resource;
        });
    }
    
    return resourceLibrary[category][id] || null;
}

// 添加资源
function addResource(category, resource) {
    if (!resourceLibrary[category]) {
        resourceLibrary[category] = {};
    }
    
    // 确保是对象格式（以ID为键）
    if (Array.isArray(resourceLibrary[category])) {
        const arrayData = resourceLibrary[category];
        resourceLibrary[category] = {};
        arrayData.forEach((existingResource, index) => {
            resourceLibrary[category][existingResource.id || `item_${index}`] = existingResource;
        });
    }
    
    resourceLibrary[category][resource.id] = resource;
}

// 更新资源
function updateResource(category, id, updates) {
    if (!resourceLibrary[category] || !resourceLibrary[category][id]) {
        return false;
    }
    
    resourceLibrary[category][id] = {
        ...resourceLibrary[category][id],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    
    return true;
}

// 删除资源
function deleteResource(category, id) {
    if (!resourceLibrary[category] || !resourceLibrary[category][id]) {
        return false;
    }
    
    delete resourceLibrary[category][id];
    return true;
}

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

module.exports = {
    loadResourceLibrary,
    saveResourceLibrary,
    getResourceLibrary,
    setResourceLibrary,
    getCategoryResources,
    setCategoryResources,
    getResource,
    addResource,
    updateResource,
    deleteResource,
    analyzeResource
};
