# 部署指南

本指南将帮助您将非遗文化传承智能体助手部署到生产环境。

## 🚀 部署选项

### 1. 传统服务器部署

#### 环境要求

- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 8+)
- **Node.js**: 18.0 或更高版本
- **内存**: 最少 2GB RAM
- **存储**: 最少 10GB 可用空间
- **网络**: 稳定的网络连接

#### 安装步骤

1. **更新系统**

   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **安装 Node.js**

   ```bash
   # 使用 NodeSource 仓库
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # 验证安装
   node --version
   npm --version
   ```

3. **安装 PM2 进程管理器**

   ```bash
   sudo npm install -g pm2
   ```

4. **克隆项目**

   ```bash
   git clone https://github.com/GuangQianHui/heritage-resource-manager.git
   cd heritage-resource-manager
   ```

5. **安装依赖**

   ```bash
   npm install
   cd resources-server
   npm install
   cd ..
   ```

6. **配置环境变量**

   ```bash
   cp env.example .env
   nano .env
   ```

   生产环境配置示例：

   ```bash
   # 生产环境配置
   NODE_ENV=production
   PORT=3000
   RESOURCE_SERVER_URL=http://your-domain.com:3001

   # 安全配置
   JWT_SECRET=your-super-secret-jwt-key
   SESSION_SECRET=your-super-secret-session-key

   # 文件上传配置
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=./uploads

   # 日志配置
   LOG_LEVEL=info
   LOG_FILE=./logs/app.log
   ```

7. **创建必要的目录**

   ```bash
   mkdir -p logs uploads
   mkdir -p resources-server/resources/{images,videos,audio,documents}
   ```

8. **启动服务**

   ```bash
   # 使用 PM2 启动主服务器
   pm2 start server.js --name "heritage-main-server"

   # 启动资源服务器
   pm2 start resources-server/server-modular.js --name "heritage-resource-server"

   # 保存 PM2 配置
   pm2 save

   # 设置开机自启
   pm2 startup
   ```

9. **配置 Nginx 反向代理**

   创建 Nginx 配置文件：

   ```bash
   sudo nano /etc/nginx/sites-available/heritage-app
   ```

   配置内容：

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       # 主服务器代理
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }

       # 静态文件代理
       location /resources/ {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       # 文件上传大小限制
       client_max_body_size 100M;
   }
   ```

   启用配置：

   ```bash
   sudo ln -s /etc/nginx/sites-available/heritage-app /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

10. **配置 SSL 证书（推荐）**

    使用 Let's Encrypt：

    ```bash
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d your-domain.com
    ```

### 2. Docker 部署

#### 创建 Dockerfile

```dockerfile
# 主服务器 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制 package.json 文件
COPY package*.json ./
COPY resources-server/package*.json ./resources-server/

# 安装依赖
RUN npm install
RUN cd resources-server && npm install

# 复制源代码
COPY . .

# 创建必要的目录
RUN mkdir -p logs uploads
RUN mkdir -p resources-server/resources/{images,videos,audio,documents}

# 暴露端口
EXPOSE 3000 3001

# 启动命令
CMD ["node", "start-servers.js"]
```

#### 创建 docker-compose.yml

```yaml
version: "3.8"

services:
  heritage-app:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - RESOURCE_SERVER_URL=http://localhost:3001
    volumes:
      - ./uploads:/app/uploads
      - ./resources-server/resources:/app/resources-server/resources
      - ./logs:/app/logs
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - heritage-app
    restart: unless-stopped
```

#### 部署命令

```bash
# 构建和启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 3. 云平台部署

#### Heroku 部署

1. **创建 Procfile**

   ```
   web: node start-servers.js
   ```

2. **设置环境变量**

   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set PORT=3000
   heroku config:set RESOURCE_SERVER_URL=https://your-app.herokuapp.com:3001
   ```

3. **部署应用**
   ```bash
   heroku create your-heritage-app
   git push heroku main
   ```

#### Vercel 部署

1. **创建 vercel.json**

   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "/server.js"
       }
     ]
   }
   ```

2. **部署命令**
   ```bash
   npm i -g vercel
   vercel
   ```

## 🔧 生产环境配置

### 安全配置

1. **防火墙设置**

   ```bash
   # Ubuntu/Debian
   sudo ufw allow 22
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **环境变量安全**

   ```bash
   # 生成强密码
   openssl rand -base64 32

   # 设置环境变量
   export JWT_SECRET="your-generated-secret"
   export SESSION_SECRET="your-generated-secret"
   ```

3. **文件权限**
   ```bash
   # 设置适当的文件权限
   chmod 755 /path/to/your/app
   chmod 644 /path/to/your/app/.env
   ```

### 性能优化

1. **PM2 集群模式**

   ```bash
   # 启动多个实例
   pm2 start server.js -i max --name "heritage-main-server"
   pm2 start resources-server/server-modular.js -i max --name "heritage-resource-server"
   ```

2. **Nginx 缓存配置**

   ```nginx
   # 静态文件缓存
   location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

3. **数据库优化（如果使用）**
   ```javascript
   // 连接池配置
   const pool = mysql.createPool({
     connectionLimit: 10,
     host: "localhost",
     user: "username",
     password: "password",
     database: "heritage_db",
   });
   ```

### 监控和日志

1. **PM2 监控**

   ```bash
   # 查看应用状态
   pm2 status

   # 查看日志
   pm2 logs

   # 监控资源使用
   pm2 monit
   ```

2. **日志轮转**

   ```bash
   # 安装 logrotate
   sudo apt install logrotate

   # 配置日志轮转
   sudo nano /etc/logrotate.d/heritage-app
   ```

   配置内容：

   ```
   /path/to/your/app/logs/*.log {
       daily
       missingok
       rotate 52
       compress
       delaycompress
       notifempty
       create 644 www-data www-data
   }
   ```

## 🔄 更新部署

### 手动更新

```bash
# 停止服务
pm2 stop heritage-main-server heritage-resource-server

# 拉取最新代码
git pull origin main

# 安装依赖
npm install
cd resources-server && npm install && cd ..

# 重启服务
pm2 restart heritage-main-server heritage-resource-server
```

### 自动化更新

创建更新脚本 `update.sh`：

```bash
#!/bin/bash

echo "开始更新应用..."

# 停止服务
pm2 stop heritage-main-server heritage-resource-server

# 备份当前版本
cp -r . ../heritage-backup-$(date +%Y%m%d-%H%M%S)

# 拉取最新代码
git pull origin main

# 安装依赖
npm install
cd resources-server && npm install && cd ..

# 重启服务
pm2 restart heritage-main-server heritage-resource-server

echo "更新完成！"
```

## 🚨 故障排除

### 常见问题

1. **端口被占用**

   ```bash
   # 查看端口占用
   netstat -tulpn | grep :3000

   # 杀死进程
   kill -9 <PID>
   ```

2. **内存不足**

   ```bash
   # 查看内存使用
   free -h

   # 增加 swap 空间
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

3. **文件权限问题**
   ```bash
   # 修复权限
   sudo chown -R $USER:$USER /path/to/your/app
   chmod -R 755 /path/to/your/app
   ```

### 日志分析

```bash
# 查看错误日志
tail -f logs/error.log

# 查看访问日志
tail -f logs/access.log

# 搜索特定错误
grep "ERROR" logs/*.log
```

## 📊 性能监控

### 系统监控

```bash
# 安装监控工具
sudo apt install htop iotop

# 监控系统资源
htop
iotop
```

### 应用监控

```bash
# PM2 监控
pm2 monit

# 查看应用状态
pm2 show heritage-main-server
```

## 🔒 安全建议

1. **定期更新系统和依赖**
2. **使用强密码和密钥**
3. **配置防火墙**
4. **启用 SSL/TLS**
5. **定期备份数据**
6. **监控异常访问**

---

_更多部署相关问题，请参考项目文档或联系开发团队。_
