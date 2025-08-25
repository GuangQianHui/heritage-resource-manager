# 🚀 快速部署指南

本指南将帮助您快速将非遗文化传承智能体助手部署到云服务器上。

## 📋 部署前准备

### 1. 购买云服务器

**推荐配置：**

- **CPU**: 2 核
- **内存**: 4GB RAM
- **存储**: 40GB SSD
- **带宽**: 5Mbps 以上
- **操作系统**: Ubuntu 20.04 LTS

**推荐平台：**

- 阿里云：https://www.aliyun.com/
- 腾讯云：https://cloud.tencent.com/
- 华为云：https://www.huaweicloud.com/

### 2. 域名准备（可选）

如果您有域名，可以配置域名解析到服务器 IP。

## 🔧 部署步骤

### 步骤 1：连接服务器

使用 SSH 连接到您的服务器：

```bash
ssh root@您的服务器IP
```

### 步骤 2：创建普通用户（安全考虑）

```bash
# 创建用户
adduser heritage
# 添加到sudo组
usermod -aG sudo heritage
# 切换到新用户
su - heritage
```

### 步骤 3：下载并运行部署脚本

```bash
# 下载部署脚本
wget https://raw.githubusercontent.com/GuangQianHui/heritage-resource-manager/main/deploy.sh

# 给脚本执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

### 步骤 4：配置域名（如果有）

编辑 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/heritage-app
```

将 `server_name _;` 替换为您的域名：

```nginx
server_name your-domain.com www.your-domain.com;
```

重新加载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 步骤 5：配置 SSL 证书（推荐）

使用 Let's Encrypt 免费 SSL 证书：

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 设置自动续期
sudo crontab -e
# 添加以下行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🌐 访问应用

部署完成后，您可以通过以下方式访问：

- **IP 访问**: http://您的服务器 IP
- **域名访问**: http://您的域名
- **HTTPS 访问**: https://您的域名（配置 SSL 后）

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

### 1. 启用 Gzip 压缩

Nginx 配置中已包含 Gzip 压缩设置。

### 2. 配置缓存

静态文件已配置 1 年缓存。

### 3. 监控资源使用

```bash
# 查看系统资源
htop
# 查看磁盘使用
df -h
# 查看内存使用
free -h
```

## 🔒 安全建议

### 1. 防火墙配置

部署脚本已自动配置 UFW 防火墙。

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

### 3. Nginx 配置错误

```bash
# 测试配置
sudo nginx -t
# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 4. 内存不足

```bash
# 查看内存使用
free -h
# 增加swap空间
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 📞 获取帮助

如果遇到问题，可以：

1. 查看项目文档：https://github.com/GuangQianHui/heritage-resource-manager
2. 提交 Issue：https://github.com/GuangQianHui/heritage-resource-manager/issues
3. 查看部署日志：`pm2 logs`

## 🎉 部署完成

恭喜！您的非遗文化传承智能体助手已经成功部署到服务器上，现在可以通过公网访问了！

---

**注意**: 请确保定期备份数据并保持系统更新。
