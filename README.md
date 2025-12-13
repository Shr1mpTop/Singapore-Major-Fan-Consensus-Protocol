# Singapore Major Bet 🎯

CS2 比赛投注系统 - 基于 Web3 的去中心化投注平台

## 🚀 部署指南 (课程项目)

### 📋 完整部署流程
**[分离部署顺序指南](DEPLOY_SEQUENCE.md)** - 步骤化部署教程

### 📋 为什么分离部署？
**[为什么前后端分离部署？](WHY_SEPARATE_DEPLOY.md)** - 课程要求 & 最佳实践

### 后端: Render.com (付费)
- **[Render.com 后端部署](DEPLOYMENT.md)** - Flask + Gunicorn

### 前端: Vercel (免费)
- **[Vercel 前端部署](FRONTEND_DEPLOY.md)** - Next.js 免费部署

## 📁 项目结构

/backend
├── .env                # 配置文件 (RPC节点, 合约地址)
├── abi.json            # 合约接口定义
├── app.py              # 主程序 (Flask + 数据库模型 + 同步逻辑)
└── requirements.txt    # 依赖包列表