
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { cookingWorkflow } from './workflows/cooking-workflow';
import { cookingProcessAgent } from "./agents/cooking-process-agent";
import { nutritionQueryAgent } from "./agents/nutrition-query-agent";
import { intentAnalysisAgent } from "./agents/intent-analysis-agent";
import { registerApiRoute } from "@mastra/core/server";

if (
  typeof process !== "undefined" &&
  process?.versions?.node &&
  process.env.PROXY_URL
) {
  const { setGlobalDispatcher, ProxyAgent } = await import("undici");
  setGlobalDispatcher(new ProxyAgent(process.env.PROXY_URL));
  console.log("[proxy] using", process.env.PROXY_URL);
}


export const mastra = new Mastra({
  workflows: { cookingWorkflow },
  agents: {
    // 三Agent架构 - 意图分析 + 专业执行
    intentAnalysisAgent,
    cookingProcessAgent,
    nutritionQueryAgent,
  },
  server: {
    port: parseInt(process.env.PORT || "4112", 10),
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
                "intentAnalysisAgent",
                "cookingProcessAgent",
                "nutritionQueryAgent",
              ],
              workflows: ["cookingWorkflow (triple-agent-coordinator)"],
              architecture: "triple-agent-workflow",
            },
          });
        },
      }),
    ],
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Cook-Mastra",
    level: "info",
  }),
});


