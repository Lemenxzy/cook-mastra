import { MCPServer } from '@mastra/mcp';
import { createGetCalorieInfoTool, createGetMultipleCaloriesTool } from './tools/index';
import { initializeFatSecretOAuth2 } from './auth/oauth2';
import { config } from "dotenv";

config();

if (
  typeof process !== "undefined" &&
  process?.versions?.node &&
  process.env.PROXY_URL
) {
  const { setGlobalDispatcher, ProxyAgent } = await import("undici");
  setGlobalDispatcher(new ProxyAgent(process.env.PROXY_URL));
  console.log("[proxy] using", process.env.PROXY_URL);
}


// 初始化认证
async function initializeAuthForServer() {
  try {
    console.log('正在初始化FatSecret OAuth2认证...');
    const oauth2Client = initializeFatSecretOAuth2();
    await oauth2Client.getAuthHeaders(); // Test authentication
    console.log('FatSecret OAuth2 认证成功');
    return true;
  } catch (error) {
    console.error('FatSecret OAuth2认证失败:', error);
    console.log('将以估算模式运行营养服务');
    return false;
  }
}

// 创建营养信息MCP服务器实例
export async function createNutritionMCPServer() {
  const authInitialized = await initializeAuthForServer();
  
  const server = new MCPServer({
    name: "Cook-Mastra Nutrition Server",
    version: "1.0.0",
    description: "营养信息服务，提供菜品卡路里和营养成分查询",
    tools: {
      getCalorieInfoTool: createGetCalorieInfoTool(),
      getMultipleCaloriesTool: createGetMultipleCaloriesTool(),
    },
  });

  return { server, authInitialized };
}

// Export a function to start the server via HTTP/SSE manually
export async function startNutritionHttpServer(port: number = 4113) {
  const { createServer } = await import('http');
  
  const { server: mcpServer, authInitialized } = await createNutritionMCPServer();

  const baseUrl = 
    typeof process !== "undefined" && process.env.NODE_ENV === "development"
      ? process.env.LOCAL_NUTRITION_SERVER_URL || 'http://localhost:4113'
      : process.env.NUTRITION_SERVER_URL || 'http://localhost:4113';
      
  console.log(`Nutrition MCP server base URL: ${baseUrl}`);
  console.log(`OAuth2 认证状态: ${authInitialized ? '已启用' : '已禁用（估算模式）'}`);

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || '', baseUrl);

    // Handle CORS for web clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: 'nutrition-server',
        oauth2_enabled: authInitialized,
        timestamp: new Date().toISOString(),
        tools: ['getCalorieInfoTool', 'getMultipleCaloriesTool']
      }));
      return;
    }

    await mcpServer.startSSE({
      url,
      ssePath: '/mcp',
      messagePath: '/mcp/message',
      req,
      res,
    });
  });

  httpServer.listen(port, () => {
    console.log(`Nutrition MCP server running on ${baseUrl}/mcp`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down Nutrition MCP server...');
    await mcpServer.close();
    httpServer.close(() => {
      console.log('Nutrition MCP server shut down complete');
      process.exit(0);
    });
  });

  return httpServer;
}

// Always start the HTTP server when this file is run
console.log('Starting Nutrition MCP Server...');
const port = parseInt(process.env.NUTRITION_PORT || '4113', 10);
startNutritionHttpServer(port).catch(console.error);