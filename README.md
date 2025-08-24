# 非遗文化传承智能体助手

一个基于 Node.js 和 Express 的传统文化遗产资源管理系统，支持六种传统文化分类的资源管理、搜索、统计和导出功能。

## 🌟 项目特色

- **六种传统文化分类**：传统美食、传统工艺、传统戏曲、传统节日、传统医药、传统建筑
- **智能资源管理**：支持资源的增删改查、分类管理、标签系统
- **多媒体支持**：支持图片、视频、音频、文档等多种媒体文件
- **动态表单**：根据资源类型自动显示对应的输入字段
- **数据统计**：实时统计资源数量、质量指标、热门标签等
- **导出功能**：支持 JSON、CSV 等多种格式的数据导出
- **模块化架构**：主服务器与资源服务器分离，支持独立部署

## 🏗️ 系统架构

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

## 📋 功能特性

### 🎯 核心功能

- **资源管理**：完整的 CRUD 操作，支持批量操作
- **分类系统**：六种传统文化分类，每种分类有专属字段
- **搜索过滤**：支持关键词搜索、分类过滤、标签筛选
- **文件上传**：支持多种文件格式，自动分类存储
- **数据统计**：实时统计和可视化展示

### 🎨 用户界面

- **响应式设计**：适配桌面和移动设备
- **现代化 UI**：使用 Tailwind CSS 构建的美观界面
- **动态表单**：根据资源类型智能显示输入字段
- **实时反馈**：操作状态实时提示和错误处理

### 🔧 技术特性

- **模块化架构**：支持独立部署和扩展
- **API 代理**：智能请求转发和负载均衡
- **缓存机制**：前端数据缓存和 API 响应缓存
- **速率限制**：防止 API 滥用，保护服务器资源
- **错误处理**：完善的错误处理和日志记录

## 🚀 快速开始

### 环境要求

- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/GuangQianHui/heritage-resource-manager.git
cd heritage-resource-manager
```

2. **安装依赖**

```bash
npm install
cd resources-server
npm install
cd ..
```

3. **配置环境变量**

```bash
cp env.example .env
# 根据需要修改 .env 文件中的配置
```

4. **启动服务器**

```bash
# 启动所有服务（推荐）
node start-servers.js

# 或分别启动
node server.js                    # 主服务器
cd resources-server && node server-modular.js  # 资源服务器
```

5. **访问应用**

- 主界面：http://localhost:3000
- API 文档：http://localhost:3001/api

## 📖 使用指南

### 添加资源

1. 点击"添加资源"按钮
2. 选择资源分类（传统美食、传统工艺等）
3. 填写基本信息（标题、描述、位置等）
4. 根据分类填写专业信息（如制作工艺、口感特色等）
5. 添加标签和关键词
6. 上传相关媒体文件
7. 保存资源

### 管理资源

- **查看资源**：支持列表和卡片两种视图
- **编辑资源**：点击编辑按钮修改资源信息
- **删除资源**：支持单个和批量删除
- **搜索资源**：使用关键词、分类、标签进行搜索
- **导出数据**：选择资源后导出为 JSON 或 CSV 格式

### 数据统计

- **总体统计**：资源总数、媒体文件数、文件大小等
- **分类统计**：各分类的资源分布和增长趋势
- **质量指标**：完整度、媒体覆盖率等质量指标
- **热门标签**：最常用的标签和关键词统计

## 🛠️ 开发指南

### 项目结构

```
├── server.js                 # 主服务器
├── index.html               # 前端界面
├── start-servers.js         # 服务器启动器
├── env.example              # 环境变量示例
├── package.json             # 项目依赖
├── resources-server/        # 资源服务器
│   ├── server.js           # 资源服务器主文件
│   ├── server-modular.js   # 模块化启动器
│   ├── config/             # 配置文件
│   ├── routes/             # API路由
│   ├── services/           # 业务逻辑
│   ├── middleware/         # 中间件
│   └── resources/          # 资源文件存储
└── README.md               # 项目说明
```

### API 接口

#### 资源管理

- `GET /api/resources/load-all` - 获取所有资源
- `POST /api/resources/batch` - 批量操作资源
- `GET /api/resources/search` - 搜索资源
- `POST /api/resources/export` - 导出资源

#### 文件管理

- `POST /api/resources/upload` - 上传文件
- `GET /resources/*` - 访问静态文件

#### 统计信息

- `GET /api/resources/stats` - 获取统计信息

### 开发模式

```bash
# 开发环境启动
NODE_ENV=development node start-servers.js

# 模块化开发
cd resources-server
node server-modular.js
```

## 🔧 配置说明

### 环境变量

| 变量名                | 默认值                  | 说明           |
| --------------------- | ----------------------- | -------------- |
| `PORT`                | `3000`                  | 主服务器端口   |
| `RESOURCE_SERVER_URL` | `http://localhost:3001` | 资源服务器地址 |
| `NODE_ENV`            | `development`           | 运行环境       |

### 服务器配置

- **主服务器**：处理前端请求和 API 代理
- **资源服务器**：提供 API 服务和文件存储
- **模块化模式**：支持独立部署资源服务器

## 📊 数据分类

### 传统美食 (traditionalFoods)

- 制作工艺、口感特色、烹饪方法
- 地域特色、历史渊源、营养价值

### 传统工艺 (traditionalCrafts)

- 制作技法、材料选择、工艺流程
- 艺术特色、文化内涵、传承历史

### 传统戏曲 (traditionalOpera)

- 唱腔特色、表演艺术、流派传承
- 剧目内容、音乐特色、舞台艺术

### 传统节日 (traditionalFestivals)

- 节日习俗、庆祝活动、文化意义
- 历史渊源、地域特色、现代传承

### 传统医药 (traditionalMedicine)

- 药材特性、功效作用、使用方法
- 理论基础、临床应用、现代研究

### 传统建筑 (traditionalArchitecture)

- 建筑技术、结构特色、装饰艺术
- 地理位置、历史背景、文化价值

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📝 更新日志

### v1.0.0 (2025-08-25)

- ✨ 初始版本发布
- 🎯 支持六种传统文化分类
- 📊 完整的资源管理功能
- 🎨 现代化用户界面
- 🔧 模块化架构设计

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- 感谢所有为传统文化传承做出贡献的人们
- 感谢开源社区提供的优秀工具和框架
- 感谢项目贡献者的辛勤工作

## 📞 联系方式

- 项目主页：https://github.com/GuangQianHui/heritage-resource-manager
- 问题反馈：https://github.com/GuangQianHui/heritage-resource-manager/issues
- 邮箱：xuqiguang9@gmail.com

---

⭐ 如果这个项目对您有帮助，请给我们一个星标！
