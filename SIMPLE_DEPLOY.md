# 🚀 简化部署指南（无Nginx）

本指南将帮助您快速将非遗文化传承智能体助手部署到云服务器上，不包含Nginx配置。

## 📋 部署前准备

### 1. 购买云服务器

**推荐配置：**
- **CPU**: 2核
- **内存**: 4GB RAM
- **存储**: 40GB SSD
- **带宽**: 5Mbps以上
- **操作系统**: Ubuntu 20.04 LTS

**推荐平台：**
- 阿里云：https://www.aliyun.com/
- 腾讯云：https://cloud.tencent.com/
- 华为云：https://www.huaweicloud.com/

### 2. 域名准备（可选）

如果您有域名，可以配置域名解析到服务器IP。

## 🔧 部署步骤

### 步骤1：连接服务器

使用SSH连接到您的服务器：

```bash
ssh root@您的服务器IP
```

### 步骤2：创建普通用户（安全考虑）

```bash
# 创建用户
adduser heritage
# 添加到sudo组
usermod -aG sudo heritage
# 切换到新用户
su - heritage
```

### 步骤3：下载并运行简化部署脚本

```bash
# 下载简化部署脚本
wget https://raw.githubusercontent.com/GuangQianHui/heritage-resource-manager/main/deploy-simple.sh

# 给脚本执行权限
chmod +x deploy-simple.sh

# 运行部署脚本
./deploy-simple.sh
```

## 🌐 访问应用

部署完成后，您可以通过以下方式访问：

- **主应用**: http://您的服务器IP:3000
- **资源服务器**: http://您的服务器IP:3001
- **域名访问**: http://您的域名:3000（需要配置域名解析）

## 🔧 管理命令

### 查看应用状态
```bash
pm2 status
```

### 查看日志
```bash
pm2 logs
```

### 重启应用
```bash
pm2 restart all
```

### 更新应用
```bash
./update.sh
```

### 监控系统
```bash
./monitor.sh
```

## 📊 性能优化

### 1. 监控资源使用
```bash
# 查看系统资源
htop
# 查看磁盘使用
df -h
# 查看内存使用
free -h
```

### 2. 应用性能监控
```bash
# 查看PM2监控
pm2 monit
```

## 🔒 安全建议

### 1. 防火墙配置
部署脚本已自动配置UFW防火墙，开放了必要的端口。

### 2. 定期更新
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 更新应用
./update.sh
```

### 3. 备份数据
```bash
# 创建备份
tar -czf backup-$(date +%Y%m%d).tar.gz /opt/heritage-app
```

## 🚨 故障排除

### 1. 应用无法启动
```bash
# 查看错误日志
pm2 logs heritage-main-server --err
pm2 logs heritage-resource-server --err
```

### 2. 端口被占用
```bash
# 查看端口占用
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001
```

### 3. 内存不足
```bash
# 查看内存使用
free -h
# 增加swap空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 🔄 后续优化（可选）

### 1. 配置域名访问

如果您有域名，可以配置域名解析：

1. 在域名提供商处添加A记录，指向您的服务器IP
2. 等待DNS解析生效（通常几分钟到几小时）

### 2. 配置SSL证书（推荐）

如果需要HTTPS访问，建议配置SSL证书：

```bash
# 安装certbot
sudo apt install certbot

# 获取SSL证书（需要域名）
sudo certbot certonly --standalone -d your-domain.com

# 配置应用使用SSL（需要修改应用代码）
```

### 3. 配置Nginx反向代理（可选）

如果后续需要更高级的功能，可以添加Nginx：

```bash
# 安装Nginx
sudo apt install nginx

# 配置反向代理
sudo nano /etc/nginx/sites-available/heritage-app
```

## 📞 获取帮助

如果遇到问题，可以：

1. 查看项目文档：https://github.com/GuangQianHui/heritage-resource-manager
2. 提交Issue：https://github.com/GuangQianHui/heritage-resource-manager/issues
3. 查看部署日志：`pm2 logs`

## 🎉 部署完成

恭喜！您的非遗文化传承智能体助手已经成功部署到服务器上，现在可以通过公网访问了！

### 访问地址
- **主应用**: http://您的服务器IP:3000
- **资源服务器**: http://您的服务器IP:3001

---

**注意**: 请确保定期备份数据并保持系统更新。
