# 🐳 Docker部署指南

本指南将帮助您使用Docker快速部署非遗文化传承智能体助手。

## 📋 前置要求

### 1. 安装Docker和Docker Compose

**Ubuntu/Debian:**
```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 将用户添加到docker组
sudo usermod -aG docker $USER
```

**CentOS/RHEL:**
```bash
# 安装Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install docker-ce docker-ce-cli containerd.io

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Windows/macOS:**
- 下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 2. 验证安装

```bash
# 验证Docker
docker --version

# 验证Docker Compose
docker-compose --version
```

## 🚀 快速部署

### 步骤1：克隆项目

```bash
git clone https://github.com/GuangQianHui/heritage-resource-manager.git
cd heritage-resource-manager
```

### 步骤2：创建环境文件

```bash
# 创建.env文件
cat > .env << EOF
NODE_ENV=production
PORT=3000
RESOURCE_SERVER_URL=http://heritage-resource-server:3001
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
LOG_LEVEL=info
LOG_FILE=./logs/app.log
EOF
```

### 步骤3：构建和启动

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

### 步骤4：查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f heritage-app
docker-compose logs -f heritage-resource-server
docker-compose logs -f nginx
```

## 🌐 访问应用

部署完成后，您可以通过以下方式访问：

- **本地访问**: http://localhost
- **服务器IP访问**: http://您的服务器IP
- **域名访问**: http://您的域名（需要配置域名解析）

## 🔧 管理命令

### 查看服务状态
```bash
docker-compose ps
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart heritage-app
```

### 停止服务
```bash
docker-compose down
```

### 更新应用
```bash
# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 查看资源使用
```bash
# 查看容器资源使用
docker stats

# 查看镜像
docker images
```

## 📊 监控和维护

### 1. 健康检查

Docker容器已配置健康检查，可以通过以下命令查看：

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### 2. 日志管理

```bash
# 查看实时日志
docker-compose logs -f --tail=100

# 导出日志
docker-compose logs heritage-app > app.log
docker-compose logs heritage-resource-server > resource.log
```

### 3. 数据备份

```bash
# 备份上传的文件
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# 备份资源文件
tar -czf resources-backup-$(date +%Y%m%d).tar.gz resources-server/resources/
```

## 🔒 安全配置

### 1. 配置SSL证书

如果您有SSL证书，可以配置HTTPS：

```bash
# 创建SSL目录
mkdir -p ssl

# 将您的证书文件复制到ssl目录
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem

# 编辑nginx.conf，取消HTTPS配置的注释
# 然后重启服务
docker-compose restart nginx
```

### 2. 防火墙配置

```bash
# 只开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## 🚨 故障排除

### 1. 容器无法启动

```bash
# 查看详细错误信息
docker-compose logs heritage-app

# 检查端口占用
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001
```

### 2. 网络连接问题

```bash
# 检查容器网络
docker network ls
docker network inspect heritage-resource-manager_heritage-network

# 进入容器调试
docker-compose exec heritage-app sh
docker-compose exec heritage-resource-server sh
```

### 3. 磁盘空间不足

```bash
# 清理未使用的镜像和容器
docker system prune -a

# 清理日志
docker system prune -f
```

### 4. 内存不足

```bash
# 查看内存使用
docker stats --no-stream

# 限制容器内存使用（在docker-compose.yml中）
# memory: 1g
# memory-swap: 2g
```

## 📈 性能优化

### 1. 资源限制

在`docker-compose.yml`中为服务添加资源限制：

```yaml
services:
  heritage-app:
    # ... 其他配置
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

### 2. 数据卷优化

使用命名卷而不是绑定挂载：

```yaml
volumes:
  - heritage_uploads:/app/uploads
  - heritage_logs:/app/logs

volumes:
  heritage_uploads:
  heritage_logs:
```

### 3. 多实例部署

```yaml
services:
  heritage-app:
    # ... 其他配置
    deploy:
      replicas: 2
```

## 🔄 自动化部署

### 1. 创建部署脚本

```bash
#!/bin/bash
# deploy.sh

echo "🚀 开始部署..."

# 拉取最新代码
git pull origin main

# 停止现有服务
docker-compose down

# 重新构建
docker-compose build --no-cache

# 启动服务
docker-compose up -d

# 清理旧镜像
docker image prune -f

echo "✅ 部署完成！"
```

### 2. 设置定时更新

```bash
# 添加到crontab
crontab -e

# 每周日凌晨2点更新
0 2 * * 0 /path/to/your/project/deploy.sh
```

## 📞 获取帮助

如果遇到问题：

1. 查看项目文档：https://github.com/GuangQianHui/heritage-resource-manager
2. 提交Issue：https://github.com/GuangQianHui/heritage-resource-manager/issues
3. 查看Docker日志：`docker-compose logs`

## 🎉 部署完成

恭喜！您的应用已经通过Docker成功部署，现在可以通过公网访问了！

---

**注意**: 请确保定期备份数据并保持Docker镜像更新。
