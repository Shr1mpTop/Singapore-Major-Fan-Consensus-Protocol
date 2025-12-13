# Singapore Major Bet - 后端部署指南 (Render.com)

## 概述

Flask后端服务部署到Render.com，用于CS2比赛投注系统的API服务。

## 💳 付费部署步骤

### 1. 添加支付信息

1. 登录 [Render.com](https://render.com)
2. 进入 **Billing** 页面
3. 点击 **Add Payment Method**
4. 添加信用卡信息
5. 验证支付方式

### 2. Blueprint 部署

1. 点击 **"New" → "Blueprint"**
2. 连接 GitHub 仓库 `Singapore-Major-Bet`
3. 选择 `main` 分支
4. Render 会自动读取 `render.yaml` 并创建两个服务

### 3. 选择实例类型

为每个服务选择付费实例：

#### 推荐配置 (课程项目)
- **Starter** ($7/月): 512MB RAM, 0.5 CPU
- **适合**: 轻量级应用，课程项目演示

#### 生产配置
- **Standard** ($25/月): 2GB RAM, 1 CPU
- **适合**: 中等流量应用

### 4. 配置环境变量

#### 后端服务 (singapore-major-bet-backend)
```
FLASK_ENV=production
INFURA_PROJECT_ID=你的Infura项目ID
ETHERSCAN_API_KEY=你的Etherscan API密钥
```

#### 前端服务 (singapore-major-bet-frontend)
```
NODE_ENV=production
NEXT_PUBLIC_BACKEND_URL=https://你的后端服务URL
```

### 5. 部署完成

部署完成后，你会获得两个URL：
- **后端API**: `https://singapore-major-bet-backend.onrender.com`
- **前端应用**: `https://singapore-major-bet-frontend.onrender.com`

## 📋 获取 API 密钥

### Infura Project ID
1. 访问 [infura.io](https://infura.io/)
2. 注册账户 (免费)
3. 创建新项目
4. 复制 Project ID

### Etherscan API Key
1. 访问 [etherscan.io/apis](https://etherscan.io/apis)
2. 注册账户 (免费)
3. 创建 API Key
4. 复制 API Key

## 🔧 部署配置说明

- **后端**: Flask + Gunicorn (2 workers)
- **前端**: Next.js + 自动优化
- **数据库**: SQLite (文件存储)
- **Web3**: Infura + Etherscan API

## 💰 费用说明

- **Starter实例**: $7/月 x 2服务 = $14/月
- **按秒计费**: 实际使用时间付费
- **免费额度**: 无 (付费实例)
- **自动扩展**: 根据需求调整

## 🚨 重要提醒

1. **支付验证**: 确保信用卡信息正确
2. **环境变量**: 部署前设置所有必需的环境变量
3. **API密钥**: 确保 Infura 和 Etherscan API 密钥有效
4. **服务连接**: 前端需要后端URL，部署后端先

## 🔍 故障排除

### 常见问题

1. **支付失败**: 检查信用卡信息和账单地址
2. **部署失败**: 查看构建日志，检查依赖
3. **API连接错误**: 确认环境变量设置正确
4. **CORS错误**: 确保后端允许前端域名

### 查看日志

在 Render 控制台中查看每个服务的日志来诊断问题。

### 4. 部署完成

部署完成后，你会获得两个URL：
- 后端API: `https://singapore-major-bet-backend.onrender.com`
- 前端应用: `https://singapore-major-bet-frontend.onrender.com`

## 故障排除

### 常见问题

1. **CORS错误**: 确保前端的 `NEXT_PUBLIC_BACKEND_URL` 设置正确
2. **API连接失败**: 检查后端服务是否正常运行
3. **构建失败**: 确保所有依赖都在 `requirements.txt` 和 `package.json` 中

### 日志查看

在Render.com控制台中查看每个服务的日志来诊断问题。

## 架构说明

- **后端**: Flask + SQLAlchemy + Web3 + Gunicorn
- **前端**: Next.js + React + TypeScript + Tailwind CSS
- **数据库**: SQLite (文件存储)
- **Web3**: Infura + Etherscan API

## 性能优化

- 使用Gunicorn作为WSGI服务器
- 配置了2个worker进程
- 设置了适当的超时和连接限制