import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { finalOutputSchema } from "./types";
import { analyzeAndPrepareContent } from "./steps/analyze-and-prepare-content";
import { fetchNutrition } from "./steps/fetch-nutrition";
import { integrateWithAgent } from "./steps/integrate-with-agent";

/**
 * 智能烹饪助手工作流程
 * 
 * 功能：智能分析用户查询 -> 生成烹饪内容 -> 营养分析 -> Agent总结输出
 * 支持：单菜查询（如"红烧鱼怎么做"）和组合推荐（如"早上吃什么"）
 * 特点：明确告知菜谱匹配状态，标注营养数据来源，提供实用建议
 */
export const cookingNutritionWorkflow = createWorkflow({
  id: 'intelligent-cooking-assistant-workflow',
  inputSchema: z.object({
    query: z.string().describe('用户原始查询'),
  }),
  outputSchema: finalOutputSchema,
})
  .then(analyzeAndPrepareContent)
  .then(fetchNutrition)
  .then(integrateWithAgent);

cookingNutritionWorkflow.commit();