后端结构
cs2-betting-backend/
├── .env                 # 配置文件 (存放 RPC 和合约地址)
├── .python-version      # uv 生成的版本文件
├── pyproject.toml       # uv 生成的依赖管理文件
├── uv.lock              # uv 生成的锁定文件
├── abi.json             # 合约接口文件 (复用之前的内容)
├── app.py               # 主后端代码
├── reset_db.py          # 数据库重置脚本
└── betting.db           # SQLite 数据库文件 (运行时自动生成)

## 环境配置

在 `.env` 文件中配置以下变量：

```env
FLASK_APP=app.py
FLASK_ENV=development
RPC_URL=https://ethereum-sepolia.publicnode.com
CONTRACT_ADDRESS=0xb5c4bea741cea63b2151d719b2cca12e80e6c7e8
ETHERSCAN_API_KEY=YourApiKeyToken  # 从 https://etherscan.io/apis 获取
```

### 获取 Etherscan API Key
1. 访问 [Etherscan API](https://etherscan.io/apis)
2. 注册账户并获取 API Key
3. 对于 Sepolia 测试网，使用相同的 API Key

## 数据同步机制

后端实现了基于 Etherscan API 的实时数据同步策略，确保数据库与区块链数据100%一致：

### 实时事件监听（主要同步机制）
- **Etherscan txlist API集成**：每分钟查询合约地址的交易记录
- **智能事件解析**：从交易收据中解析合约事件日志
- **智能去重机制**：使用交易哈希防止重复处理相同交易
- **内存优化**：自动清理旧的已处理哈希，避免内存泄漏
- **NewBet事件**：监听用户下注事件，实时记录到数据库并更新统计数据
- **GameStatusChanged事件**：监听游戏状态变化，实时更新游戏状态
- **WinnerSelected事件**：监听获胜者选择，实时更新结果
- **优势**：实时性强，数据一致性高，直接查询合约交易

### 同步流程
1. 用户在前端下注 → 智能合约记录交易并触发事件
2. Etherscan 记录交易和事件日志
3. 后端每分钟查询 Etherscan txlist API 获取合约交易 → 从收据解析事件 → 去重处理 → 更新数据库
4. 前端通过 React Query 自动刷新显示最新数据

### 性能优化
- **查询频率**：每60秒检查一次新区块交易
- **去重机制**：基于交易哈希的智能去重，防止重复处理
- **内存管理**：自动清理过期哈希，控制内存使用
- **错误处理**：网络超时和API错误自动重试
- **批量处理**：每次最多处理100条交易记录

这种设计确保了数据同步的高效性、可靠性和实时性。