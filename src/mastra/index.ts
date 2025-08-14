
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { cookingNutritionWorkflow } from "./workflows/cooking-workflow-new";
import { cookingProcessAgent } from "./agents/cooking-process-agent";
import { nutritionQueryAgent } from "./agents/nutrition-query-agent";
import { responseIntegrationAgent } from "./agents/response-integration-agent";
import { registerApiRoute } from "@mastra/core/server";
import {createNutritionMCPServer} from './mcp/mcp-nutrition/nutrition-server';
import {createCookMCPServer} from './mcp/mcp-cooking/mcp-server';
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";
import { config } from "dotenv";

// if (process.env.NODE_ENV !== 'production') {
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

const cookServer = await createCookMCPServer();
const nutritionServer = await createNutritionMCPServer();
export const mastra = new Mastra({
  workflows: { cookingNutritionWorkflow },
  agents: {
    cookingProcessAgent,
    nutritionQueryAgent,
    responseIntegrationAgent,
  },
  deployer: new CloudflareDeployer({
    projectName: "cook-mastra-api",
    scope: process.env.CLOUDFLARE_ACCOUNT_EMAIL || "",
    auth: {
      apiToken: process.env.CLOUDFLARE_API_TOKEN || "",
      apiEmail: process.env.CLOUDFLARE_ACCOUNT_EMAIL || "",
    },
  }),
  mcpServers: {
    cookMCPServer: await createCookMCPServer(),
    nutritionMCPServer: await createNutritionMCPServer(),
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
      registerApiRoute("/mcp/cookMCPServer/mcp", {
        // 用一个路由承接 Streamable HTTP（GET/POST 都会打到这）
        method: "ALL",
        handler: async (c: { req: any; body: (body: any) => any }) => {
          await cookServer.startHTTP({
            url: new URL(c.req.url),
            httpPath: "/mcp/cookMCPServer/mcp",
            // Hono 运行在 Node 时，可从上下文取到原始 req/res；
            // 如果你的运行环境不是 Node，可改用 startSSE()
            req: (c as any).req.raw,
            res: (c as any).res.raw,
          });
          // startHTTP 会自行写入响应，这里返回空体即可
          return c.body(null);
        },
      }),
      registerApiRoute("/mcp/nutritionMCPServer/mcp", {
        method: "ALL",
        handler: async (c: { req: any; body: (body: any) => any }) => {
          await nutritionServer.startHTTP({
            url: new URL(c.req.url),
            httpPath: "/mcp/nutritionMCPServer/mcp",
            req: (c as any).req.raw,
            res: (c as any).res.raw,
          });
          return c.body(null);
        },
      }),
    ],
  },
  logger: new PinoLogger({
    name: "Cook-Mastra",
    level: "info",
  }),
});


