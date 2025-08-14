
import { Mastra } from '@mastra/core/mastra';
import { cookingNutritionWorkflow } from "./workflows/cooking-workflow-new";
import { cookingProcessAgent } from "./agents/cooking-process-agent";
import { nutritionQueryAgent } from "./agents/nutrition-query-agent";
import { responseIntegrationAgent } from "./agents/response-integration-agent";
import { registerApiRoute } from "@mastra/core/server";
import {createNutritionMCPServer} from './mcp/mcp-nutrition/nutrition-server';
import {createCookMCPServer} from './mcp/mcp-cooking/mcp-server';
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";
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

// const cookServer = await createCookMCPServer();
// const nutritionServer = await createNutritionMCPServer();

let cookServerPromise: ReturnType<typeof createCookMCPServer> | null = null;
let nutritionServerPromise: ReturnType<typeof createNutritionMCPServer> | null = null;

const getCookServer = () => (cookServerPromise ??= createCookMCPServer()); // 注意：不要在顶层 await
const getNutritionServer = () =>
  (nutritionServerPromise ??= createNutritionMCPServer());


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
    cookMCPServer: await getCookServer(),
    nutritionMCPServer: await getNutritionServer(),
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
    ],
  },
});


