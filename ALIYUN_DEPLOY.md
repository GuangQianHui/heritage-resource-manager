# 🚀 阿里云服务器部署指南

本指南专门针对阿里云ECS服务器，提供完整的部署方案和优化建议。

## 📋 阿里云服务器准备

### 1. 购买阿里云ECS实例

**推荐配置：**
- **实例规格**: ecs.g6.large (2核4G) 或 ecs.g6.xlarge (4核8G)
- **操作系统**: 
  - Ubuntu 20.04 LTS (推荐)
  - CentOS 7.9
  - Alibaba Cloud Linux 3
- **存储**: 40GB ESSD云盘
- **带宽**: 5Mbps以上
- **地域**: 根据用户分布选择（推荐：华东1-杭州）

**购买步骤：**
1. 访问 [阿里云ECS控制台](https://ecs.console.aliyun.com/)
2. 点击"创建实例"
3. 选择推荐配置
4. 设置密码或密钥对
5. 完成购买

### 2. 配置安全组

**必需端口：**
- **22**: SSH连接
- **3000**: 主应用端口
- **3001**: 资源服务器端口

**配置步骤：**
1. 在ECS控制台找到您的实例
2. 点击"安全组" → "配置规则"
3. 添加入方向规则：
   ```
   端口范围: 22/22, 协议类型: SSH, 授权对象: 0.0.0.0/0
   端口范围: 3000/3000, 协议类型: 自定义TCP, 授权对象: 0.0.0.0/0
   端口范围: 3001/3001, 协议类型: 自定义TCP, 授权对象: 0.0.0.0/0
   ```

### 3. 域名准备（可选）

如果您有域名，可以：
1. 在阿里云域名控制台添加解析记录
2. 将域名解析到ECS公网IP
3. 等待DNS解析生效

## 🔧 部署步骤

### 步骤1：连接阿里云ECS

使用SSH连接到您的ECS实例：

```bash
# 使用密码连接
ssh root@您的ECS公网IP

# 或使用密钥对连接
ssh -i your-key.pem root@您的ECS公网IP
```

### 步骤2：创建普通用户（安全考虑）

```bash
# 创建用户
adduser heritage

# 添加到sudo组
usermod -aG sudo heritage  # Ubuntu
# 或
usermod -aG wheel heritage  # CentOS

# 切换到新用户
su - heritage
```

### 步骤3：下载并运行阿里云专用部署脚本

```bash
# 下载阿里云专用部署脚本
wget https://raw.githubusercontent.com/GuangQianHui/heritage-resource-manager/main/deploy-aliyun.sh

# 给脚本执行权限
chmod +x deploy-aliyun.sh

# 运行部署脚本
./deploy-aliyun.sh
```

## 🌐 访问应用

部署完成后，您可以通过以下方式访问：

- **主应用**: http://您的ECS公网IP:3000
- **资源服务器**: http://您的ECS公网IP:3001
- **域名访问**: http://您的域名:3000（如果配置了域名）

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

### 阿里云优化
```bash
./optimize-aliyun.sh
```

## 📊 阿里云性能优化

### 1. 系统参数优化

运行阿里云优化脚本：
```bash
./optimize-aliyun.sh
```

### 2. 监控资源使用

```bash
# 查看系统资源
htop
# 查看磁盘使用
df -h
# 查看内存使用
free -h
```

### 3. 应用性能监控

```bash
# 查看PM2监控
pm2 monit
```

## 🔒 阿里云安全配置

### 1. 安全组配置

确保安全组已正确配置：
- 只开放必要端口（22, 3000, 3001）
- 限制SSH访问IP（可选）
- 定期检查安全组规则

### 2. 系统安全

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y  # Ubuntu
# 或
sudo yum update -y  # CentOS

# 更新应用
./update.sh
```

### 3. 数据备份

```bash
# 创建备份
tar -czf backup-$(date +%Y%m%d).tar.gz /opt/heritage-app

# 上传到阿里云OSS（可选）
# 需要配置阿里云CLI和OSS工具
```

## 🚨 故障排除

### 1. 应用无法启动

```bash
# 查看错误日志
pm2 logs heritage-main-server --err
pm2 logs heritage-resource-server --err

# 检查端口占用
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001
```

### 2. 网络连接问题

```bash
# 检查安全组配置
# 在阿里云控制台检查安全组规则

# 检查防火墙
sudo ufw status  # Ubuntu
sudo firewall-cmd --list-all  # CentOS
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

### 4. 磁盘空间不足

```bash
# 查看磁盘使用
df -h

# 清理日志文件
sudo find /opt/heritage-app/logs -name "*.log" -mtime +7 -delete
```

## 🔄 阿里云高级配置

### 1. 配置阿里云SLB负载均衡

如果需要负载均衡：
1. 在阿里云控制台创建SLB实例
2. 添加ECS实例到后端服务器组
3. 配置监听端口（3000, 3001）
4. 配置健康检查

### 2. 配置阿里云RDS数据库

如果需要数据库：
1. 创建RDS实例
2. 配置数据库连接
3. 修改应用配置使用RDS

### 3. 配置阿里云OSS存储

如果需要对象存储：
1. 创建OSS Bucket
2. 配置AccessKey
3. 修改应用使用OSS存储文件

### 4. 配置阿里云CDN

如果需要CDN加速：
1. 添加域名到CDN
2. 配置源站为ECS实例
3. 配置缓存规则

## 📈 监控和告警

### 1. 阿里云云监控

在阿里云控制台：
1. 配置ECS实例监控
2. 设置CPU、内存、磁盘告警
3. 配置网络流量监控

### 2. 应用监控

```bash
# 查看应用状态
pm2 status

# 查看实时监控
pm2 monit

# 查看日志
pm2 logs --lines 100
```

## 🔄 自动化部署

### 1. 使用阿里云CodePipeline

配置CI/CD流程：
1. 连接GitHub仓库
2. 配置构建步骤
3. 配置部署步骤

### 2. 使用阿里云函数计算

配置自动更新：
```bash
# 创建定时任务
crontab -e

# 添加自动更新任务
0 2 * * 0 /opt/heritage-app/update.sh
```

## 📞 阿里云支持

### 1. 官方支持

- **阿里云控制台**: https://ecs.console.aliyun.com/
- **阿里云文档**: https://help.aliyun.com/
- **阿里云技术支持**: 400-801-3268

### 2. 项目支持

- **项目文档**: https://github.com/GuangQianHui/heritage-resource-manager
- **问题反馈**: https://github.com/GuangQianHui/heritage-resource-manager/issues

## 🎉 部署完成

恭喜！您的应用已经成功部署到阿里云ECS上！

### 访问地址
- **主应用**: http://您的ECS公网IP:3000
- **资源服务器**: http://您的ECS公网IP:3001

### 下一步建议
1. 配置域名解析
2. 申请SSL证书
3. 配置阿里云SLB负载均衡
4. 设置监控告警
5. 配置自动备份

---

**注意**: 请确保定期备份数据并保持系统更新。阿里云提供了丰富的云服务，可以根据需要进一步优化您的应用架构。
