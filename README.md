项目结构
```bash
/CS2-Major-Betting-Backend
├── prisma/                    # Prisma ORM 配置目录
│   └── schema.prisma          # 数据库模型定义文件
├── src/                       # 项目源码
│   ├── api/                   # Express API 相关
│   │   ├── controllers/       # 控制器：处理请求逻辑
│   │   │   ├── gameController.js
│   │   │   └── adminController.js
│   │   ├── middlewares/       # 中间件：如API密钥验证
│   │   │   └── auth.js
│   │   └── routes/            # 路由：定义API端点
│   │       ├── game.js
│   │       ├── admin.js
│   │       └── index.js
│   ├── config/                # 配置文件
│   │   └── index.js           # 环境变量和配置
│   ├── database/              # 数据库初始化和客户端
│   │   └── prismaClient.js
│   ├── listeners/             # 区块链事件监听器
│   │   └── eventListener.js
│   ├── services/              # 核心业务逻辑
│   │   └── blockchainService.js
│   └── utils/                 # 工具函数
│       └── formatters.js
├── .env                       # 环境变量 (!!重要!!)
├── .gitignore                 # Git忽略文件配置
├── package.json               # 项目依赖和脚本
└── index.js                   # 应用主入口文件
```