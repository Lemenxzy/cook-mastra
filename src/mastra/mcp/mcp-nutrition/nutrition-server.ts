import { MCPServer } from '@mastra/mcp';
import { createGetCalorieInfoTool, createGetMultipleCaloriesTool } from './tools/index';
import { initializeFatSecretOAuth2 } from './auth/oauth2';
import { config } from "dotenv";

if (process.env.NODE_ENV !== 'production') {
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
  console.log(
    `OAuth2 认证状态: ${authInitialized ? "已启用" : "已禁用（估算模式）"}`
  );
  const server = new MCPServer({
    name: "nutrition",
    version: "1.0.0",
    description: "营养信息服务，提供菜品卡路里和营养成分查询",
    tools: {
      getCalorieInfoTool: createGetCalorieInfoTool(),
      getMultipleCaloriesTool: createGetMultipleCaloriesTool(),
    },
  });

  return server;
}

