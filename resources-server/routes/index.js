const express = require('express');
const router = express.Router();

// 导入所有路由模块
const basicRoutes = require('./basic');
const uploadRoutes = require('./upload');
const resourceRoutes = require('./resources');
const mediaRoutes = require('./media');
const batchRoutes = require('./batch');
const statsRoutes = require('./stats');

// 注册基础路由
router.use('/', basicRoutes);

// 注册上传路由
router.use('/upload', uploadRoutes);

// 注册资源路由
router.use('/resources', resourceRoutes);

// 注册媒体文件路由
router.use('/resources', mediaRoutes);

// 注册批量操作路由
router.use('/resources', batchRoutes);

// 注册统计路由
router.use('/resources', statsRoutes);

module.exports = router;
