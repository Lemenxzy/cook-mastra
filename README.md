# Cook Mastra - AI 智能烹饪助手

基于 Mastra 框架构建的 AI 驱动的烹饪营养分析系统，提供智能食谱分析、营养计算和个性化饮食建议。

## 🌟 功能特性

- **智能食谱分析**: 基于多 Agent 协作的食谱内容分析
- **营养成分计算**: 精确的食材营养价值分析
- **实时流式响应**: 基于 SSE 的实时数据流
- **MCP 服务器架构**: 模块化的工具服务集成
- **Cloudflare Workers 部署**: 全球边缘计算支持
- **自动预热机制**: 定时任务确保服务性能

## 📋 系统架构

### 三重 Agent 协作工作流

```
用户输入 → 烹饪处理Agent → 营养查询Agent → 响应整合Agent → 结构化输出
```

1. **烹饪处理Agent** (`cookingProcessAgent`): 解析食谱内容，提取食材信息
2. **营养查询Agent** (`nutritionQueryAgent`): 查询营养数据库，计算营养成分
3. **响应整合Agent** (`responseIntegrationAgent`): 整合结果，生成最终报告

### MCP 服务器

- **Cook MCP Server**: 处理烹饪相关工具调用
- **Nutrition MCP Server**: 提供营养数据查询服务
- **懒加载架构**: 避免 Cloudflare Workers 全局作用域限制

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Cloudflare Workers 账户
- OpenAI API Key

### 安装依赖

```bash
npm install
```

### 环境配置

创建 `.env` 文件：

```env
OPENAI_API_KEY=your_openai_api_key
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_EMAIL=your_cloudflare_email
```

### 本地开发

```bash
npm run dev
```

### 部署到 Cloudflare Workers

```bash
npm run deploy
```

## 📡 API 文档

### 健康检查

```
GET /health
```

响应示例：
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "agents": ["cookingProcessAgent", "nutritionQueryAgent", "responseIntegrationAgent"],
    "workflows": ["cookingNutritionWorkflow (triple-agent-coordinator)"],
    "architecture": "triple-agent-workflow"
  }
}
```

### 服务预热

```
GET /warmup
```

触发 MCP 服务器初始化，提升首次调用性能。

### 工作流执行

#### 创建工作流运行

```
POST /workflows/cookingNutritionWorkflow/create-run
```

请求体：
```json
{
  "inputData": {
    "query": "分析这道红烧肉的营养成分"
  }
}
```

#### 流式执行工作流

```
POST /workflows/cookingNutritionWorkflow/stream
```

请求体：
```json
{
  "inputData": {
    "query": "分析番茄炒蛋的营养价值"
  }
}
```

响应格式：Server-Sent Events (SSE)
```
data: {"type":"step","payload":{"id":"step_1","output":"正在分析食谱..."}}

data: {"type":"step","payload":{"id":"step_2","output":"计算营养成分..."}}

data: {"type":"completion","payload":{"result":"分析完成"}}
```

## 🏗️ 项目结构

```
cook-mastra/
├── src/
│   ├── mastra/
│   │   ├── agents/              # AI Agents
│   │   │   ├── cooking-process-agent.ts
│   │   │   ├── nutrition-query-agent.ts
│   │   │   └── response-integration-agent.ts
│   │   ├── workflows/           # 工作流定义
│   │   │   └── cooking-workflow-new.ts
│   │   ├── mcp/                # MCP 服务器
│   │   │   ├── lazy-mcp-server.ts
│   │   │   ├── mcp-cooking/
│   │   │   └── mcp-nutrition/
│   │   └── index.ts            # 主配置文件
│   └── web/                    # 前端应用
│       └── src/
│           └── lib/
│               └── api.ts      # API 客户端
├── scripts/
│   └── post-build.cjs          # 构建后处理脚本
├── wrangler.toml               # Cloudflare Workers 配置
└── package.json
```

## 🔧 核心技术实现

### Cloudflare Workers 兼容性

为解决 Cloudflare Workers 的限制，采用了以下技术方案：

1. **懒加载架构**: 避免全局作用域的异步操作
2. **代理模式**: 延迟 MCP 服务器实例化
3. **运行时依赖注入**: 避免循环依赖问题

```typescript
// 懒加载 MCP 服务器
let cookMCPServer: LazyMCPServer | null = null;

export function getCookMCPServer(): LazyMCPServer {
  if (!cookMCPServer) {
    cookMCPServer = new LazyMCPServer(createCookMCPServer, {
      name: "cooking",
      version: "1.0.0",
      tools: {}
    });
  }
  return cookMCPServer;
}
```

### 自动预热机制

通过后构建脚本注入 `scheduled` 函数，实现自动预热：

```javascript
// scripts/post-build.cjs
scheduled: async (controller, env, context) => {
  console.log("Cron job triggered - warming up MCP servers");
  const response = await fetch('https://cookapi.chuzilaoxu.uk/warmup');
  // 处理响应...
}
```

### MCP 架构

采用进程内 MCP 服务器而非 HTTP 客户端，实现零延迟工具调用：

```typescript
// 运行时依赖注入
tools: async ({ mastra }) => {
  const mcpServers = mastra.getMCPServers();
  const cookServer = mcpServers.cookMCPServer;
  const toolsInfo = await cookServer.getToolListInfo();
  return toolsInfo;
}
```

## 🚨 故障排除

### 常见问题

1. **top-level await 错误**
   - 解决方案: 使用懒加载模式，将异步操作移至请求处理器内

2. **randomUUID 全局作用域错误**
   - 解决方案: 在请求处理器内生成 UUID，避免全局作用域操作

3. **MCP 端点 404 错误**
   - 解决方案: 确保 API 路由正确注册，检查 CloudflareDeployer 配置

4. **COOKING_AGENT_ERROR**
   - 检查 PROXY_URL 环境变量是否正确配置
   - 确认 OpenAI API Key 有效性

5. **scheduled() 函数未导出**
   - 确保后构建脚本正确执行
   - 检查 `.mastra/output/index.mjs` 文件中是否包含 scheduled 函数

### 部署检查清单

- [ ] 环境变量配置完整
- [ ] Cloudflare API Token 权限正确
- [ ] 域名 DNS 配置正确
- [ ] 移除 PROXY_URL（生产环境）
- [ ] 后构建脚本执行成功
- [ ] Cron 触发器配置正确

## 🌐 生产环境

- **API 域名**: https://cookapi.chuzilaoxu.uk
- **自动预热**: 每 15 分钟执行一次
- **监控**: 通过 `/health` 端点检查服务状态

## 📦 依赖项

### 主要依赖

- `@mastra/core`: Mastra 核心框架
- `@mastra/deployer-cloudflare`: Cloudflare Workers 部署器
- `hono`: 轻量级 Web 框架
- `openai`: OpenAI API 客户端

### 开发依赖

- `typescript`: TypeScript 支持
- `@types/node`: Node.js 类型定义
- `wrangler`: Cloudflare Workers CLI

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔗 相关链接

- [Mastra 文档](https://docs.mastra.ai)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [OpenAI API 文档](https://platform.openai.com/docs)

---

**注意**: 本项目专注于防御性安全任务，仅用于合法的烹饪营养分析用途。