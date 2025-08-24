const express = require('express');
const router = express.Router();
const config = require('../config/config');

// 服务器状态检查
router.get('/status', (req, res) => {
    res.json({
        success: true,
        message: '资源服务器运行正常',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// 获取所有分类
router.get('/categories', (req, res) => {
    try {
        res.json({
            success: true,
            categories: config.categories,
            count: Object.keys(config.categories).length
        });
    } catch (error) {
        console.error('获取分类失败:', error);
        res.status(500).json({
            success: false,
            error: '获取分类失败'
        });
    }
});

module.exports = router;
