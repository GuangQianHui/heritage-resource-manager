# 模块化架构总结

## 项目概述

本项目采用模块化架构设计，将资源服务器从主服务器中分离出来，实现了更好的可维护性和可扩展性。

## 架构设计

### 整体架构

```
┌─────────────────┐    ┌──────────────────┐
│   主服务器      │    │   资源服务器      │
│  (端口3000)     │◄──►│   (端口3001)     │
│                 │    │                  │
│ - 前端服务      │    │ - API服务        │
│ - 代理转发      │    │ - 文件服务       │
│ - 统一入口      │    │ - 数据管理       │
└─────────────────┘    └──────────────────┘
```

### 模块化优势

1. **解耦合**: 主服务器和资源服务器职责分离
2. **可扩展**: 可以独立扩展资源服务器
3. **可维护**: 代码结构更清晰，便于维护
4. **可部署**: 支持独立部署和负载均衡

## 核心模块

### 1. 主服务器 (server.js)

**职责**:

- 提供前端静态文件服务
- 代理 API 请求到资源服务器
- 处理文件上传转发
- 提供统一的服务入口

**关键特性**:

- 智能代理转发
- 文件上传处理
- CORS 配置
- 错误处理

### 2. 资源服务器 (resources-server/server.js)

**职责**:

- 提供 RESTful API
- 管理资源数据
- 处理文件存储
- 提供统计信息

**关键特性**:

- 完整的 CRUD 操作
- 文件上传和管理
- 搜索和过滤
- 数据统计

### 3. 模块化启动器 (server-modular.js)

**职责**:

- 独立启动资源服务器
- 环境配置管理
- 进程管理
- 优雅关闭

**关键特性**:

- 环境变量配置
- 进程监控
- 错误处理
- 信号处理

## 通信机制

### API 代理

主服务器通过代理将 API 请求转发到资源服务器：

```javascript
// 代理配置
app.use("/api/resources", async (req, res, next) => {
  const target = `${RESOURCE_SERVER_URL}/api/resources${path}`;
  // 转发请求...
});
```

### 文件上传

文件上传通过主服务器接收，然后转发到资源服务器：

```javascript
// 文件上传处理
if (req.headers["content-type"].includes("multipart/form-data")) {
  options.body = req;
  options.duplex = "half";
}
```

## 配置管理

### 环境变量

```bash
# 主服务器配置
PORT=3000
RESOURCE_SERVER_URL=http://localhost:3001

# 资源服务器配置
PORT=3001
NODE_ENV=development
```

### 配置文件

- `resources-server/config/config.js`: 资源服务器配置
- `env.example`: 环境变量示例

## 部署方案

### 开发环境

```bash
# 启动所有服务
node start-servers.js

# 或分别启动
node server.js                    # 主服务器
cd resources-server && node server-modular.js  # 资源服务器
```

### 生产环境

```bash
# 使用PM2部署
pm2 start server.js --name "main-server"
pm2 start resources-server/server-modular.js --name "resource-server"
```

## 性能优化

### 1. 缓存策略

- 前端数据缓存
- API 响应缓存
- 静态文件缓存

### 2. 请求优化

- 请求队列管理
- 重试机制
- 速率限制

### 3. 文件处理

- 流式传输
- 文件压缩
- CDN 集成

## 监控和日志

### 日志记录

- 请求日志
- 错误日志
- 性能日志

### 监控指标

- API 响应时间
- 文件上传成功率
- 服务器资源使用

## 安全考虑

### 1. CORS 配置

```javascript
cors: {
    origins: ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}
```

### 2. 速率限制

```javascript
rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100
}
```

### 3. 文件类型验证

```javascript
allowedTypes: ["image/jpeg", "image/png", "video/mp4", "audio/mpeg"];
```

## 未来扩展

### 1. 数据库集成

- MongoDB/PostgreSQL 支持
- 数据迁移工具
- 备份和恢复

### 2. 微服务架构

- 服务发现
- 负载均衡
- 容器化部署

### 3. 云服务集成

- 对象存储
- CDN 服务
- 监控服务

## 总结

模块化架构为项目提供了良好的基础，支持未来的扩展和维护。通过合理的职责分离和通信机制，实现了高效、可扩展的系统架构。
