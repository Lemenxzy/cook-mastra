
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

// import { config } from "dotenv";
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

// Lazy MCP server factories to avoid global scope instantiation
let cookMCPServer: LazyMCPServer | null = null;
let nutritionMCPServer: LazyMCPServer | null = null;

export function getCookMCPServer(): LazyMCPServer {
  if (!cookMCPServer) {
    cookMCPServer = new LazyMCPServer(
      createCookMCPServer,
      {
        name: "cooking",
        version: "1.0.0",
        tools: {} // Placeholder, will be replaced when initialized
      }
    );
  }
  return cookMCPServer;
}

export function getNutritionMCPServer(): LazyMCPServer {
  if (!nutritionMCPServer) {
    nutritionMCPServer = new LazyMCPServer(
      createNutritionMCPServer,
      {
        name: "nutrition", 
        version: "1.0.0",
        tools: {} // Placeholder, will be replaced when initialized
      }
    );
  }
  return nutritionMCPServer;
}

// Helper functions for warmup and cron jobs - trigger initialization
const warmupCookServer = async () => {
  try {
    const server = getCookMCPServer();
    await server.getToolListInfo(); // This will trigger initialization
    return true;
  } catch (error) {
    console.error('Failed to warmup cook server:', error);
    return false;
  }
};

const warmupNutritionServer = async () => {
  try {
    const server = getNutritionMCPServer();
    await server.getToolListInfo(); // This will trigger initialization  
    return true;
  } catch (error) {
    console.error('Failed to warmup nutrition server:', error);
    return false;
  }
};


// Create a proxy object for MCP servers that lazily initializes them
const mcpServersProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'cookMCPServer') {
      return getCookMCPServer();
    }
    if (prop === 'nutritionMCPServer') {
      return getNutritionMCPServer();
    }
    return undefined;
  },
  ownKeys() {
    return ['cookMCPServer', 'nutritionMCPServer'];
  },
  has(target, prop) {
    return prop === 'cookMCPServer' || prop === 'nutritionMCPServer';
  }
});

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
  mcpServers: mcpServersProxy,
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
      // 路径转发：因为CloudflareDeployer不暴露原生workflow API，需要转发
      registerApiRoute("/workflows/cookingNutritionWorkflow/create-run", {
        method: "POST",
        handler: async (c: any) => {
          // 直接调用Mastra工作流API
          try {
            const body = await c.req.json();
            const workflows = mastra.getWorkflows();
            const workflow = workflows.cookingNutritionWorkflow;
            const run = await workflow.createRun(body.inputData);
            return c.json({ runId: run.runId, id: run.runId, workflowId: run.workflowId });
          } catch (error) {
            console.error('Create run error:', error);
            return c.json({ error: 'Failed to create run' }, 500);
          }
        },
      }),
      registerApiRoute("/workflows/cookingNutritionWorkflow/stream", {
        method: "POST",
        handler: async (c: any) => {
          try {
            const body = await c.req.json();
            const workflows = mastra.getWorkflows();
            const workflow = workflows.cookingNutritionWorkflow;
            
            // 直接创建run并流式执行
            const run = await workflow.createRun(body.inputData);
            const { stream } = run.stream({ inputData: body.inputData });
            
            // 创建SSE流
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            
            // 异步处理流
            (async () => {
              try {
                for await (const event of stream) {
                  await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
                }
              } catch (error) {
                console.error('Stream error:', error);
                await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`));
              } finally {
                await writer.close();
              }
            })();
            
            return new Response(readable, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              },
            });
          } catch (error) {
            console.error('Stream workflow error:', error);
            return c.json({ error: 'Failed to stream workflow' }, 500);
          }
        },
      }),
    ],
  },
});

import { Hono } from 'hono';

// Lazy initialization of Hono app
let app: Hono | null = null;

async function getApp(): Promise<Hono> {
  if (!app) {
    app = new Hono();
    
    // Mount Mastra's API routes
    const serverConfig = mastra.getServer();
    if (serverConfig?.apiRoutes) {
      console.log("Mounting API routes...", serverConfig.apiRoutes);
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
  }
  
  return app;
}

// Cloudflare Workers export
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const honoApp = await getApp();
    return honoApp.fetch(request, env, ctx);
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


