# 贡献指南

感谢您对非遗文化传承智能体助手项目的关注！我们欢迎所有形式的贡献，包括但不限于代码贡献、文档改进、问题报告和功能建议。

## 🤝 如何贡献

### 1. 报告问题

如果您发现了 bug 或有功能建议，请：

1. 在 [Issues](https://github.com/GuangQianHui/heritage-resource-manager/issues) 页面搜索是否已有相关问题
2. 如果没有找到相关问题，请创建新的 Issue
3. 使用清晰的标题描述问题
4. 在描述中提供详细的信息：
   - 问题发生的环境（操作系统、Node.js 版本等）
   - 重现步骤
   - 期望的行为
   - 实际的行为
   - 错误信息或截图

### 2. 提交代码

#### 准备工作

1. Fork 项目到您的 GitHub 账户
2. 克隆您的 fork 到本地：
   ```bash
   git clone https://github.com/GuangQianHui/heritage-resource-manager.git
   cd heritage-resource-manager
   ```
3. 添加上游仓库：
   ```bash
   git remote add upstream https://github.com/original-username/heritage-resource-manager.git
   ```

#### 开发流程

1. **创建功能分支**

   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

2. **安装依赖**

   ```bash
   npm install
   cd resources-server
   npm install
   cd ..
   ```

3. **开发功能**

   - 编写代码
   - 添加测试（如果适用）
   - 更新文档
   - 确保代码符合项目规范

4. **测试**

   ```bash
   # 启动开发服务器
   node start-servers.js

   # 运行测试（如果有）
   npm test
   ```

5. **提交代码**

   ```bash
   git add .
   git commit -m "feat: add new feature description"
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 在 GitHub 上创建 Pull Request
   - 填写 PR 模板
   - 等待代码审查

## 📝 代码规范

### 提交信息格式

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**类型 (type)**：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**：

```
feat: add export functionality for resources
fix: resolve API rate limiting issue
docs: update installation guide
style: format code according to eslint rules
```

### 代码风格

- 使用 2 个空格缩进
- 使用单引号
- 行尾不要分号（JavaScript）
- 使用 ES6+语法
- 添加适当的注释

### 文件命名

- 使用 kebab-case 命名文件
- 使用 PascalCase 命名类
- 使用 camelCase 命名变量和函数

## 🏗️ 项目结构

### 主要目录

```
├── server.js                 # 主服务器
├── index.html               # 前端界面
├── start-servers.js         # 服务器启动器
├── resources-server/        # 资源服务器
│   ├── server.js           # 资源服务器主文件
│   ├── config/             # 配置文件
│   ├── routes/             # API路由
│   ├── services/           # 业务逻辑
│   ├── middleware/         # 中间件
│   └── resources/          # 资源文件存储
└── docs/                   # 文档
```

### 开发指南

#### 添加新功能

1. **API 开发**

   - 在 `resources-server/routes/` 中添加路由
   - 在 `resources-server/services/` 中实现业务逻辑
   - 更新 API 文档

2. **前端开发**

   - 修改 `index.html` 中的 JavaScript 代码
   - 更新 UI 组件
   - 添加相应的样式

3. **配置更新**
   - 更新 `resources-server/config/config.js`
   - 更新 `env.example`

#### 测试

- 单元测试：使用 Jest 或 Mocha
- 集成测试：测试 API 接口
- 端到端测试：测试完整用户流程

## 🔧 开发环境设置

### 环境要求

- Node.js 18.0+
- npm 或 yarn
- Git

### 本地开发

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

3. **配置环境**

   ```bash
   cp env.example .env
   # 根据需要修改 .env 文件
   ```

4. **启动开发服务器**

   ```bash
   node start-servers.js
   ```

5. **访问应用**
   - 主界面：http://localhost:3000
   - API：http://localhost:3001/api

## 📋 Pull Request 检查清单

在提交 Pull Request 之前，请确保：

- [ ] 代码符合项目规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 提交信息符合规范
- [ ] 代码已经过本地测试
- [ ] 没有引入新的警告或错误

## 🐛 常见问题

### 端口冲突

如果遇到端口被占用的问题：

```bash
# 查看端口占用
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# 杀死进程
taskkill /PID <进程ID> /F
```

### 依赖安装失败

```bash
# 清除缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules
npm install
```

## 📞 联系我们

如果您有任何问题或需要帮助：

- 创建 [Issue](https://github.com/GuangQianHui/heritage-resource-manager/issues)
- 发送邮件到：xuqiguang9@gmail.com
- 加入我们的讨论群：[链接]

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！您的贡献让这个项目变得更好。

---

再次感谢您的贡献！🎉
