import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { step1OutputSchema } from "../types";

/**
 * Step 1: 智能分析并生成烹饪内容
 * 
 * 功能：
 * - 调用烹饪Agent智能分析用户查询
 * - 识别查询类型（单菜/组合推荐）
 * - 生成完整烹饪内容
 * - 解析Agent输出的结构化信息
 */
export const analyzeAndPrepareContent = createStep({
  id: "analyze-and-prepare-content",
  description: "调用烹饪Agent智能分析用户查询，识别查询类型（单菜/组合推荐），生成完整烹饪内容",
  inputSchema: z.object({
    query: z.string().describe("用户查询"),
  }),
  outputSchema: step1OutputSchema,
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    const cookingAgent = mastra?.getAgent("cookingProcessAgent");

    if (!cookingAgent) {
      console.warn("⚠️ cookingProcessAgent 不可用");
      return {
        originalQuery: query,
        queryType: "single" as const,
        identifiedDishes: [],
        detailedDish: undefined,
        hasAnyRecipe: false,
        cookingInfoRaw: "COOKING_AGENT_UNAVAILABLE",
        approxMethod: undefined,
        candidates: undefined,
      };
    }

    try {
      const resp = await cookingAgent.generate([
        {
          role: "user",
          content: `用户查询: "${query}"`,
        },
      ]);

      // 解析Agent输出
      const text = resp.text || "";
      const lines = text.split(/\r?\n/);
      
      let dishes: string[] = [];
      let queryType: 'single' | 'combination' = 'single';
      let detailedDish: string | undefined;
      
      // 查找JSON行（通常在前几行）
      let jsonFound = false;
      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i].trim().replace(/^\uFEFF/, "");
        
        // 跳过空行和注释行
        if (!line || line.startsWith('#') || line.startsWith('//')) {
          continue;
        }
        
        // 尝试解析JSON
        if (line.startsWith('{') && line.includes('"type"')) {
          try {
            const obj = JSON.parse(line);
            if (obj) {
              if (Array.isArray(obj.dishes)) {
                dishes = obj.dishes.filter(Boolean);
              }
              if (obj.type === 'combination' || obj.type === 'single') {
                queryType = obj.type;
              }
              if (obj.detailed) {
                detailedDish = obj.detailed;
              }
              jsonFound = true;
              console.log("✅ 成功解析Agent JSON输出:", obj);
              break;
            }
          } catch (parseError) {
            console.warn(`⚠️ 解析第${i+1}行JSON失败:`, line, parseError?.message);
            continue;
          }
        }
      }
      
      if (!jsonFound) {
        console.warn("⚠️ 未找到有效的JSON输出，使用默认值");
        console.log("Agent完整输出:", text.substring(0, 200) + "...");
      }

      // 提取候选菜品
      let candidates: string[] = [];
      const candMatch = text.match(/##\s*CANDIDATES[\r\n]+([^\n#]+)/i);
      if (candMatch && candMatch[1]) {
        candidates = candMatch[1]
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // 提取大致做法（当无菜谱时）
      let approxMethod: string | undefined;
      if (dishes.length === 0) {
        const approxMatch = text.match(
          /##\s*APPROX_METHOD[\r\n]+([\s\S]*?)(?=\n##\s*[A-Z_ ]+|\s*$)/i
        );
        if (approxMatch && approxMatch[1]) {
          approxMethod = approxMatch[1]
            .replace(/^\s*(?:[-*]|\d+\.)\s*/gm, "")
            .trim();
        }
      }

      return {
        originalQuery: query,
        queryType,
        identifiedDishes: dishes,
        detailedDish,
        hasAnyRecipe: dishes.length > 0,
        cookingInfoRaw: text,
        approxMethod,
        candidates,
      };
    } catch (e) {
      console.error("❌ 调用 cookingProcessAgent 失败:", e);
      return {
        originalQuery: query,
        queryType: "single" as const,
        identifiedDishes: [],
        detailedDish: undefined,
        hasAnyRecipe: false,
        cookingInfoRaw: "COOKING_AGENT_ERROR",
        approxMethod: undefined,
        candidates: undefined,
      };
    }
  },
});