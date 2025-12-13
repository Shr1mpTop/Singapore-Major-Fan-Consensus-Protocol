# 🚀 分离部署顺序指南

## 📋 部署步骤总览

### 第一步：后端部署 (Render.com - 付费)
1. 添加支付信息
2. 创建后端服务
3. 配置环境变量
4. 部署并获取URL

### 第二步：前端部署 (Vercel - 免费)
1. 注册Vercel账户
2. 导入项目
3. 配置环境变量
4. 部署完成

## 🎯 为什么这个方案完美？

### ✅ 符合课程要求
- 两个独立的服务部署
- 每个服务都是单独的"service"
- 满足"只可以部署service"的限制

### 💰 成本最优
- **后端**: $7/月 (Starter实例)
- **前端**: $0/月 (Vercel免费)
- **总计**: $7/月

### 🏗️ 架构合理
- **后端**: Render (适合Flask + 数据库)
- **前端**: Vercel (专为Next.js优化)
- **性能**: 前端CDN加速，后端稳定运行

## 📝 详细步骤

### Phase 1: 后端部署

按照 [DEPLOYMENT.md](DEPLOYMENT.md) 部署后端：

1. **添加支付信息** 到Render.com账户
2. **创建Web Service**:
   - Name: `singapore-major-bet-backend`
   - Root Directory: `backend`
   - Start Command: `gunicorn --config gunicorn.conf.py app:app`
   - Instance Type: Starter ($7/月)
3. **设置环境变量**:
   - `FLASK_ENV=production`
   - `INFURA_PROJECT_ID=你的API密钥`
   - `ETHERSCAN_API_KEY=你的API密钥`
4. **部署成功**后，复制URL: `https://xxx.onrender.com`

### Phase 2: 前端部署

按照 [FRONTEND_DEPLOY.md](FRONTEND_DEPLOY.md) 部署前端：

1. **注册Vercel** (GitHub账户)
2. **导入项目**:
   - 选择 `Singapore-Major-Bet` 仓库
   - Root Directory: `frontend`
3. **设置环境变量**:
   - `NEXT_PUBLIC_BACKEND_URL=https://你的后端URL`
4. **部署完成**，获得前端URL

## 🔗 服务连接

部署完成后：
- **前端**: `https://你的项目.vercel.app`
- **后端**: `https://你的服务.onrender.com`
- **连接**: 前端通过环境变量连接后端API

## ✅ 验证部署

1. 访问前端URL
2. 检查是否能正常加载
3. 测试API调用 (查看浏览器开发者工具)
4. 确认前后端通信正常

## 🎉 完成！

你的CS2投注系统现在运行在：
- 现代化的前后端分离架构
- 生产级的云服务
- 符合课程要求的部署方式

这个方案既满足技术要求，又展示了工业级部署实践！🚀