
import { Mastra } from '@mastra/core/mastra';
import { cookingNutritionWorkflow } from "./workflows/cooking-workflow-new";
import { cookingProcessAgent } from "./agents/cooking-process-agent";
import { nutritionQueryAgent } from "./agents/nutrition-query-agent";
import { responseIntegrationAgent } from "./agents/response-integration-agent";
import { registerApiRoute } from "@mastra/core/server";
import {createNutritionMCPServer} from './mcp/mcp-nutrition/nutrition-server';
import {createCookMCPServer} from './mcp/mcp-cooking/mcp-server';
import { LazyMCPServer } from './mcp/lazy-mcp-server';
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";
import { config } from "dotenv";

// if (process && process.env && process.env.NODE_ENV === "development") {
//   config();
//   if (
//     typeof process !== "undefined" &&
//     process?.versions?.node &&
//     process.env.PROXY_URL
//   ) {
//     const { setGlobalDispatcher, ProxyAgent } = await import("undici");
//     setGlobalDispatcher(new ProxyAgent(process.env.PROXY_URL));
//     console.log("[proxy] using", process.env.PROXY_URL);
//   }
// }

// Create lazy-loaded MCP servers for Cloudflare Workers compatibility
const cookMCPServer = new LazyMCPServer(
  createCookMCPServer,
  {
    name: "cooking",
    version: "1.0.0",
    tools: {} // Placeholder, will be replaced when initialized
  }
);

const nutritionMCPServer = new LazyMCPServer(
  createNutritionMCPServer,
  {
    name: "nutrition", 
    version: "1.0.0",
    tools: {} // Placeholder, will be replaced when initialized
  }
);

// Helper functions for warmup and cron jobs - trigger initialization
const warmupCookServer = async () => {
  try {
    await cookMCPServer.getToolListInfo(); // This will trigger initialization
    return true;
  } catch (error) {
    console.error('Failed to warmup cook server:', error);
    return false;
  }
};

const warmupNutritionServer = async () => {
  try {
    await nutritionMCPServer.getToolListInfo(); // This will trigger initialization  
    return true;
  } catch (error) {
    console.error('Failed to warmup nutrition server:', error);
    return false;
  }
};


export const mastra = new Mastra({
  workflows: { cookingNutritionWorkflow },
  agents: {
    cookingProcessAgent,
    nutritionQueryAgent,
    responseIntegrationAgent,
  },
  deployer: new CloudflareDeployer({
    projectName: "cook-mastra-api",
    scope: globalThis.process?.env?.CLOUDFLARE_ACCOUNT_EMAIL || "",
    auth: {
      apiToken: globalThis.process?.env?.CLOUDFLARE_API_TOKEN || "",
      apiEmail: globalThis.process?.env?.CLOUDFLARE_ACCOUNT_EMAIL || "",
    },
  }),
  mcpServers: {
    cookMCPServer,
    nutritionMCPServer,
  },
  server: {
    timeout: 30000,
    apiRoutes: [
      registerApiRoute("/health", {
        method: "GET",
        handler: async (c) => {
          return c.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            services: {
              agents: [
                "cookingProcessAgent",
                "nutritionQueryAgent",
                "responseIntegrationAgent",
              ],
              workflows: [
                "cookingNutritionWorkflow (triple-agent-coordinator)",
              ],
              architecture: "triple-agent-workflow",
            },
          });
        },
      }),
      registerApiRoute("/warmup", {
        method: "GET",
        handler: async (c) => {
          try {
            console.log("开始预热MCP服务器...");
            const startTime = Date.now();
            
            // 并行预热两个MCP服务器
            const [cookResult, nutritionResult] = await Promise.all([
              warmupCookServer(),
              warmupNutritionServer()
            ]);
            
            const endTime = Date.now();
            console.log(`MCP服务器预热完成，耗时: ${endTime - startTime}ms`);
            
            return c.json({
              status: "warmup_completed",
              timestamp: new Date().toISOString(),
              duration_ms: endTime - startTime,
              servers: {
                cookMCPServer: cookResult ? "initialized" : "failed",
                nutritionMCPServer: nutritionResult ? "initialized" : "failed"
              }
            });
          } catch (error) {
            console.error("预热失败:", error);
            return c.json({
              status: "warmup_failed",
              error: error instanceof Error ? error.message : "Unknown error",
              timestamp: new Date().toISOString()
            }, 500);
          }
        },
      }),
    ],
  },
});

import { Hono } from 'hono';

// Create a Hono app to handle requests
const app = new Hono();

// Mount Mastra's API routes
const serverConfig = mastra.getServer();
if (serverConfig?.apiRoutes) {
  for (const route of serverConfig.apiRoutes) {
    let handler;
    
    if ('handler' in route) {
      handler = route.handler;
    } else if ('createHandler' in route) {
      handler = await route.createHandler({ mastra });
    } else {
      continue;
    }
    
    app.on(route.method.toLowerCase() as any, route.path, handler);
  }
}

// Cloudflare Workers export
export default {
  async fetch(request: Request, env: any, ctx: any) {
    return app.fetch(request, env, ctx);
  },
  
  async scheduled(event: any, env: any, ctx: any) {
    console.log("Cron job triggered - warming up MCP servers");
    try {
      const startTime = Date.now();
      await Promise.all([warmupCookServer(), warmupNutritionServer()]);
      const endTime = Date.now();
      console.log(`Cron warmup completed in ${endTime - startTime}ms`);
    } catch (error) {
      console.error("Cron warmup failed:", error);
    }
  }
};


