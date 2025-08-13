# Cook-Mastra: 智能烹饪助手与MCP集成

基于Mastra框架的智能烹饪助手，连接到HowToCook MCP（模型上下文协议）服务，提供食谱推荐、饮食规划和烹饪指导。

## 功能特点

- 🍳 食谱搜索和推荐
- 📖 详细的食谱信息（包含食材和制作步骤）
- 📅 支持饮食限制的每周饮食规划
- 🎲 随机餐点建议
- 💬 交互式烹饪聊天助手
- 🌐 RESTful API接口
- ☁️ 支持Cloudflare Workers部署

## Prerequisites

- Node.js >= 20.9.0
- Your HowToCook MCP server running locally (default: http://localhost:3000/mcp)
- OpenAI API key (for the AI agent)

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your OpenAI API key (create `.env` file):
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

## Development

### Start the Mastra development server:
```bash
npm run dev
```
The server will be available at http://localhost:4111

### Start the Cloudflare Worker development server:
```bash
npm run dev:worker
```

## API Endpoints

### Recipe Search
```bash
POST /api/recipes/search
Content-Type: application/json

{
  "query": "chicken curry",
  "category": "meat_dishes"  // optional: seafood, breakfast, meat_dishes, staples
}
```

### Recipe Details
```bash
POST /api/recipes/details
Content-Type: application/json

{
  "recipeName": "Chicken Curry"
}
```

### Weekly Menu Generation
```bash
POST /api/menu/weekly
Content-Type: application/json

{
  "people": 3,
  "allergies": ["cilantro", "shrimp"]
}
```

### Random Meal Suggestion
```bash
POST /api/meal/random
Content-Type: application/json

{
  "mealType": "dinner"  // breakfast, lunch, dinner, any
}
```

### Chat with Cooking Assistant
```bash
POST /api/chat
Content-Type: application/json

{
  "message": "How do I make pasta?",
  "conversationId": "optional_conversation_id"
}
```

### Workflow Execution
```bash
POST /api/workflow/cooking
Content-Type: application/json

{
  "query": "I want to cook something with chicken"
}
```

## MCP集成说明

本项目使用Mastra的MCP客户端通过SSE传输方式集成HowToCook MCP服务。MCP客户端连接到您的HowToCook MCP服务器以：

- 按类别或搜索词查询食谱
- 获取详细食谱信息
- 生成个性化餐点推荐
- 提供随机餐点建议

### 环境配置

项目支持自动环境检测：

- **开发环境**: `http://localhost:3000/sse`
- **生产环境**: `https://cookai.chuzilaoxu.uk/sse`

### MCP服务器配置

MCP配置在`src/mastra/mcp.ts`中，支持SSE传输：

```typescript
export const mcp = new MCPClient({
  servers: {
    howtocook: {
      // 使用 SSE 传输连接到 HowToCook MCP 服务
      url: getMCPServerURL(),
      // 明确指定使用 SSE 传输
      transport: 'sse'
    }
  }
});
```

环境变量优先级：
1. 如果设置了 `MCP_SERVER_URL`，使用该值
2. 生产环境 (`NODE_ENV=production`)：`https://cookai.chuzilaoxu.uk/sse`
3. 开发环境（默认）：`http://localhost:3000/sse`

## Deployment

### Cloudflare Workers

1. 构建Worker:
   ```bash
   npm run build:worker
   ```

2. 部署到Cloudflare（开发环境）:
   ```bash
   npm run deploy
   ```

3. 部署到生产环境:
   ```bash
   wrangler deploy --env production
   ```

4. 在Cloudflare Workers控制面板设置环境变量:
   - `OPENAI_API_KEY`: 您的OpenAI API密钥
   - `NODE_ENV`: `development` 或 `production`
   - `MCP_SERVER_URL`: (可选) 自定义MCP服务器URL

### Traditional Build

1. Build the Mastra application:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Project Structure

```
cook-mastra/
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   └── cooking-agent.ts     # AI cooking assistant
│   │   ├── tools/
│   │   │   └── cooking-tool.ts      # MCP integration tools
│   │   ├── workflows/
│   │   │   └── cooking-workflow.ts  # Cooking workflow definition
│   │   └── index.ts                 # Main Mastra configuration
│   └── worker.ts                    # Cloudflare Worker entry point
├── wrangler.toml                    # Cloudflare Workers configuration
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # This file
```

## 可用工具

烹饪代理通过MCP服务器自动获取这些工具：

- 食谱搜索和查询工具
- 每周菜单生成工具  
- 详细食谱信息获取工具
- 随机餐点推荐工具

这些工具通过`getMCPTools()`函数动态加载，确保与HowToCook MCP服务器的实时连接。

## Example Frontend Integration

```javascript
// Search for recipes
const response = await fetch('/api/recipes/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'pasta',
    category: 'staples'
  })
});

const recipes = await response.json();
console.log(recipes);
```

## Troubleshooting

1. **MCP Connection Issues**: Ensure your HowToCook MCP server is running and accessible
2. **Build Errors**: Make sure you're using Node.js >= 20.9.0
3. **API Key Issues**: Check your OpenAI API key is set correctly
4. **CORS Issues**: The API includes CORS headers for frontend access

## Development Notes

- The project uses TypeScript with ES2022 target
- Mastra handles the AI agent orchestration
- MCP client uses SSE transport for real-time communication
- Cloudflare Workers runtime is supported for edge deployment