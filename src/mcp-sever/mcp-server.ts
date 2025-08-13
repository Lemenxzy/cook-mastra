import { MCPServer } from '@mastra/mcp';
import { fetchRecipes, getAllCategories } from './data/recipes';
import { Recipe } from './types';
import { 
  createGetAllRecipesTool,
  createGetRecipesByCategoryTool,
  createGetRecipeByIdTool,
  createRecommendMealsTool,
  createWhatToEatTool
} from './tools';

import { config } from "dotenv";

config();

// 初始化数据
async function initializeData() {
  try {
    console.log('正在加载菜谱数据...');
    let recipesCache: Recipe[] = await fetchRecipes();
    let categoriesCache: string[] = getAllCategories(recipesCache);
    console.log(`成功加载 ${recipesCache.length} 个菜谱，${categoriesCache.length} 个分类`);
    return {
      recipes: recipesCache,
      categories: categoriesCache
    };
  } catch (error) {
    console.error('加载菜谱数据失败:', error);
  }
}

// 创建MCP服务器实例
export async function createMCPServer() {
  const initFoodData = await initializeData();

  const server = new MCPServer({
    name: "Cook-Mastra HowToCook Server",
    version: "1.0.0",
    tools: {
      getAllRecipesTool: createGetAllRecipesTool(initFoodData),
      getRecipesByCategoryTool: createGetRecipesByCategoryTool(initFoodData),
      getRecipeByIdTool: createGetRecipeByIdTool(initFoodData),
      recommendMealsTool: createRecommendMealsTool(initFoodData),
      whatToEatTool: createWhatToEatTool(initFoodData),
    },
  });

  return server;
}


const mcpServer = await createMCPServer();

// Export a function to start the server via HTTP/SSE manually
export async function startHttpServer(port: number = 4111) {
  const { createServer } = await import('http');

  const baseUrl =
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "development"
      ? process.env.LOCAL_MCP_SERVER_URL
      : process.env.MCP_SERVER_URL;
  console.log(`MCP server base URL: ${baseUrl}`);
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
    await mcpServer.startSSE({
      url,
      ssePath: '/mcp',
      messagePath: '/mcp/message',
      req,
      res,
    });
  });

  httpServer.listen(port, () => {
    console.log(`MCP server running on ${baseUrl}/mcp`);
  });


 process.on('SIGINFO', async (e) => {
   console.log('Received SIGINFO signal:', e);
 });

  // Graceful shutdown
  process.on('SIGINT', async (e) => {
    console.log('Shutting down MCP server...');
    await mcpServer.close();
    httpServer.close((e) => {
      console.log("MCP server shut down complete", e);
      process.exit(0);
    });
  });

  return httpServer;
}

// If this file is run directly, start the HTTP server
const port = parseInt(process.env.MCP_PORT || '4111', 10);
startHttpServer(port).catch(console.error);
