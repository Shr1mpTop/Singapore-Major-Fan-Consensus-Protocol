# 🚀 前端部署到 Vercel (免费)

## 为什么选择 Vercel？

- ✅ **完全免费** - 无需信用卡
- ✅ **Next.js 优化** - 专为 Next.js 设计
- ✅ **全球 CDN** - 快速访问
- ✅ **自动 HTTPS** - 免费 SSL
- ✅ **GitHub 集成** - 推送自动部署

## 部署步骤

### 1. 注册 Vercel 账户

1. 访问 [vercel.com](https://vercel.com)
2. 使用 GitHub 账户注册 (推荐)

### 2. 导入项目

1. 点击 **"New Project"**
2. 选择 **"Import Git Repository"**
3. 搜索并选择 `Singapore-Major-Bet` 仓库

### 3. 配置项目

在项目配置页面：

- **Project Name**: `singapore-major-bet-frontend` (或自定义)
- **Root Directory**: `frontend`
- **Framework Preset**: Next.js (自动检测)

### 4. 环境变量

点击 **"Environment Variables"** 添加：

```
NEXT_PUBLIC_BACKEND_URL=https://你的Render后端URL
```

**重要**: 后端URL格式应该是 `https://你的服务名.onrender.com`

### 5. 部署

1. 点击 **"Deploy"**
2. 等待构建完成 (通常需要 2-3 分钟)
3. 获得前端URL: `https://你的项目名.vercel.app`

## 🔧 高级配置 (可选)

### 自定义域名

1. 在 Vercel 项目设置中
2. 点击 **"Domains"**
3. 添加你的自定义域名

### 构建设置

如果需要自定义构建：

- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## 📱 测试部署

部署完成后：

1. 访问前端URL
2. 检查是否能连接到后端API
3. 测试所有功能是否正常

## 🔍 故障排除

### 常见问题

1. **构建失败**: 检查 `frontend/package.json` 依赖
2. **环境变量**: 确保 `NEXT_PUBLIC_BACKEND_URL` 设置正确
3. **API连接**: 确认后端服务正在运行

### 查看日志

在 Vercel 控制台查看构建和运行时日志。

## 💡 提示

- Vercel 会自动检测代码变更并重新部署
- 免费额度足够课程项目使用
- 支持预览部署 (PR 自动创建预览)