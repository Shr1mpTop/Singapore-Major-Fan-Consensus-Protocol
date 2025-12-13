# 🤔 为什么前后端分离部署？

## 课程项目要求分析

根据你的要求"只可以部署service"，我们采用前后端分离部署方案：

### 🎯 架构优势

#### 1. **符合课程要求**
- 单个 Render service (后端)
- 单个 Vercel service (前端)
- 满足"只能部署service"的限制

#### 2. **成本优化**
- **后端**: Render Starter $7/月 (需要付费)
- **前端**: Vercel 完全免费
- **总成本**: $7/月 (vs $14/月双服务)

#### 3. **技术优化**
- **Vercel**: 专为 Next.js 优化，全球 CDN
- **Render**: 适合 Flask + Gunicorn 后端
- **性能**: 前端静态资源全球加速

### 📊 对比方案

| 方案 | 服务数量 | 每月费用 | 优势 | 适用场景 |
|------|----------|----------|------|----------|
| Blueprint (双服务) | 2个Render服务 | $14/月 | 统一管理 | 企业项目 |
| 分离部署 | 1个Render + 1个Vercel | $7/月 | 成本最低 | 课程项目 ✅ |
| 单体部署 | 1个服务 | $7/月 | 简单 | 简单应用 |

### 🚀 部署流程

#### 第一步: 后端部署到 Render
1. 使用 `render.yaml` 创建后端服务
2. 添加支付信息 ($7/月)
3. 设置环境变量
4. 获得后端URL: `https://xxx.onrender.com`

#### 第二步: 前端部署到 Vercel
1. 导入 GitHub 仓库
2. 设置 Root Directory: `frontend`
3. 添加环境变量: `NEXT_PUBLIC_BACKEND_URL`
4. 免费部署获得前端URL

### 💡 为什么这个方案最佳？

1. **符合要求**: 都是单个service部署
2. **成本最低**: 前端完全免费
3. **性能最佳**: Vercel CDN 加速前端
4. **维护简单**: 各自平台优化配置
5. **扩展性好**: 可独立扩展前后端

### 🔧 技术实现

#### 后端 (Render)
- Flask + SQLAlchemy
- Gunicorn 生产服务器
- SQLite 数据库
- Web3 集成

#### 前端 (Vercel)
- Next.js 13+ App Router
- TypeScript + Tailwind CSS
- React Query 数据获取
- 自动静态优化

### 📈 课程项目优势

- ✅ 展示现代全栈架构
- ✅ 云原生部署实践
- ✅ 成本控制意识
- ✅ DevOps 最佳实践
- ✅ 微服务思维

这个分离部署方案既满足课程要求，又展示了工业级部署实践！🎯