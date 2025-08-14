import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * 智能烹饪助手工作流程
 * 
 * 功能：智能分析用户查询 -> 生成烹饪内容 -> 营养分析 -> Agent总结输出
 * 支持：单菜查询（如"红烧鱼怎么做"）和组合推荐（如"早上吃什么"）
 * 特点：明确告知菜谱匹配状态，标注营养数据来源，提供实用建议
 */

/* Step 1: 智能分析并生成烹饪内容 */
const analyzeAndPrepareContent = createStep({
  id: "analyze-and-prepare-content",
  description: "调用烹饪Agent智能分析用户查询，识别查询类型（单菜/组合推荐），生成完整烹饪内容",
  inputSchema: z.object({
    query: z.string().describe("用户查询"),
  }),
  outputSchema: z.object({
    originalQuery: z.string(),
    queryType: z.enum(['single', 'combination']).describe("查询类型：单菜或组合推荐"),
    identifiedDishes: z.array(z.string()).describe("从库中识别出的菜名（0~N）"),
    detailedDish: z.string().optional().describe("需要展示详细步骤的主菜名"),
    hasAnyRecipe: z.boolean().describe("是否至少有一个菜名"),
    cookingInfoRaw: z.string().optional().describe("烹饪Agent的完整输出内容"),
    approxMethod: z.string().optional().describe("当无菜谱时的大致做法"),
    candidates: z
      .array(z.string())
      .optional()
      .describe("近似候选菜名（可为空）"),
  }),
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

      // 1) 解析首行 JSON（新格式）
      const text = resp.text || "";
      const firstLine = text.split(/\r?\n/, 1)[0].trim();

      // 兼容可能出现的 BOM
      const safeFirstLine = firstLine.replace(/^\uFEFF/, "");

      let dishes: string[] = [];
      let queryType: 'single' | 'combination' = 'single';
      let detailedDish: string | undefined;
      
      try {
        const obj = JSON.parse(safeFirstLine);
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
        }
      } catch (parseError) {
        console.warn("⚠️ 解析Agent输出JSON失败:", parseError);
        // 解析失败时保持默认值
      }

      // 2) 提取 CANDIDATES（若有）
      let candidates: string[] = [];
      const candMatch = text.match(/##\s*CANDIDATES[\r\n]+([^\n#]+)/i);
      if (candMatch && candMatch[1]) {
        candidates = candMatch[1]
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      // 3) 当 dishes 为空时，提取大致做法 APPROX_METHOD
      let approxMethod: string | undefined;
      if (dishes.length === 0) {
        const approxMatch = text.match(
          /##\s*APPROX_METHOD[\r\n]+([\s\S]*?)(?=\n##\s*[A-Z_ ]+|\s*$)/i
        );
        if (approxMatch && approxMatch[1]) {
          // 清理列表前缀（-/* 或 1. 2.）
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

/* Step 2: 营养信息分析 */
const fetchNutrition = createStep({
  id: "fetch-nutrition",
  description: "根据识别的菜品和查询类型，调用营养Agent进行热量和营养成分分析",
  inputSchema: z.object({
    originalQuery: z.string(),
    queryType: z.enum(['single', 'combination']),
    identifiedDishes: z.array(z.string()),
    detailedDish: z.string().optional(),
    hasAnyRecipe: z.boolean(),
    approxMethod: z.string().optional(),
    candidates: z.array(z.string()).optional(),
    cookingInfoRaw: z.string().optional(),
  }),
  outputSchema: z.object({
    originalQuery: z.string(),
    queryType: z.enum(['single', 'combination']),
    identifiedDishes: z.array(z.string()),
    detailedDish: z.string().optional(),
    hasAnyRecipe: z.boolean(),
    hasNutritionInfo: z.boolean(),
    nutritionInfo: z.string().optional(),
    approxMethod: z.string().optional(),
    candidates: z.array(z.string()).optional(),
    cookingInfoRaw: z.string().optional().describe("烹饪Agent的原始输出"),
  }),
  execute: async ({ inputData, mastra }) => {
    const {
      originalQuery,
      queryType,
      identifiedDishes,
      detailedDish,
      hasAnyRecipe,
      approxMethod,
      candidates,
      cookingInfoRaw,
    } = inputData;

    if (!hasAnyRecipe) {
      // 未命中菜谱：不查营养，直接透传大致做法
      return {
        originalQuery,
        queryType,
        identifiedDishes,
        detailedDish,
        hasAnyRecipe,
        hasNutritionInfo: false,
        nutritionInfo: undefined,
        approxMethod,
        candidates,
        cookingInfoRaw,
      };
    }

    const nutritionAgent = mastra?.getAgent("nutritionQueryAgent");
    if (!nutritionAgent) {
      console.warn("⚠️ nutritionQueryAgent 不可用");
      return {
        originalQuery,
        queryType,
        identifiedDishes,
        detailedDish,
        hasAnyRecipe,
        hasNutritionInfo: false,
        approxMethod,
        candidates,
        cookingInfoRaw,
      };
    }

    try {
      // 统一的营养查询策略
      const dishList = identifiedDishes.join("、");
      const queryTypeText = queryType === 'combination' ? '搭配组合' : '菜品';
      
      const prompt = `请给出以下${queryTypeText}的营养信息（至少包含每份的卡路里、蛋白质、脂肪、碳水化合物），按列表逐一回复：${dishList}。如果份量未指定，请以常见标准份量假设，并在结果中说明假设。`;

      const resp = await nutritionAgent.generate([
        { role: "user", content: prompt },
      ]);
      return {
        originalQuery,
        queryType,
        identifiedDishes,
        detailedDish,
        hasAnyRecipe,
        hasNutritionInfo: true,
        nutritionInfo: resp.text || "",
        approxMethod,
        candidates,
        cookingInfoRaw,
      };
    } catch (e) {
      console.error("❌ 调用 nutritionQueryAgent 失败:", e);
      return {
        originalQuery,
        queryType,
        identifiedDishes,
        detailedDish,
        hasAnyRecipe,
        hasNutritionInfo: false,
        approxMethod,
        candidates,
        cookingInfoRaw,
      };
    }
  },
});

// ---- Step 3: Agent智能整合输出 ----
const integrateWithAgent = createStep({
  id: 'integrate-with-agent',
  description: '调用专门的总结Agent，智能整合烹饪信息和营养数据，生成用户友好的最终回复',
  inputSchema: z.object({
    originalQuery: z.string(),
    queryType: z.enum(['single', 'combination']),
    identifiedDishes: z.array(z.string()),
    detailedDish: z.string().optional(),
    hasAnyRecipe: z.boolean(),
    hasNutritionInfo: z.boolean(),
    nutritionInfo: z.string().optional(),
    approxMethod: z.string().optional(),
    candidates: z.array(z.string()).optional(),
    cookingInfoRaw: z.string().optional().describe("烹饪Agent的原始输出"),
  }),
  outputSchema: z.object({
    response: z.string(),
    metadata: z.object({
      dishes: z.array(z.string()),
      queryType: z.enum(['single', 'combination']),
      detailedDish: z.string().optional(),
      hasAnyRecipe: z.boolean(),
      hasNutritionInfo: z.boolean(),
      architecture: z.string(),
    }),
  }),
  execute: async ({ inputData, mastra }) => {
    const { 
      originalQuery, 
      queryType, 
      identifiedDishes, 
      detailedDish, 
      hasAnyRecipe, 
      hasNutritionInfo, 
      nutritionInfo, 
      approxMethod, 
      candidates,
      cookingInfoRaw
    } = inputData;

    const integrationAgent = mastra?.getAgent("responseIntegrationAgent");
    
    if (!integrationAgent) {
      console.error("⚠️ responseIntegrationAgent 不可用");
      return {
        response: "系统暂时不可用，请稍后重试。",
        metadata: {
          dishes: identifiedDishes,
          queryType,
          detailedDish,
          hasAnyRecipe,
          hasNutritionInfo: !!hasNutritionInfo,
          architecture: 'recipe->nutrition:agent-unavailable',
        },
      };
    }

    try {
      // 构建给总结Agent的详细上下文
      const contextPrompt = `请整合以下信息，生成用户友好的回复：

**用户查询**: "${originalQuery}"
**查询类型**: ${queryType === 'single' ? '单菜查询' : '组合推荐'}
**菜谱匹配状态**: ${hasAnyRecipe ? '已找到菜谱' : '未找到菜谱'}
**识别到的菜品**: ${identifiedDishes.length > 0 ? identifiedDishes.join('、') : '无'}
**详细展示菜品**: ${detailedDish || '无'}

${hasAnyRecipe && cookingInfoRaw ? `**烹饪信息**:\n${cookingInfoRaw}` : ''}

${!hasAnyRecipe && approxMethod ? `**大致做法**:\n${approxMethod}` : ''}

${candidates && candidates.length > 0 ? `**候选建议**: ${candidates.join('、')}` : ''}

**营养信息状态**: ${hasNutritionInfo ? '已获取' : '未获取'}
${hasNutritionInfo && nutritionInfo ? `**营养分析结果**:\n${nutritionInfo}` : ''}

请生成完整的回复，务必：
1. 明确告知用户菜谱匹配结果
2. 如有营养信息，标注"以上营养数据由AI营养分析系统提供，仅供参考"
3. 提供实用的建议和指导`;

      const response = await integrationAgent.generate([
        {
          role: 'user',
          content: contextPrompt
        }
      ]);

      return {
        response: response.text || '生成回复失败，请重试。',
        metadata: {
          dishes: identifiedDishes,
          queryType,
          detailedDish,
          hasAnyRecipe,
          hasNutritionInfo: !!hasNutritionInfo,
          architecture: 'recipe->nutrition:agent-integrated',
        },
      };
      
    } catch (error) {
      console.error("❌ 调用 responseIntegrationAgent 失败:", error);
      return {
        response: "生成回复时发生错误，请重试。",
        metadata: {
          dishes: identifiedDishes,
          queryType,
          detailedDish,
          hasAnyRecipe,
          hasNutritionInfo: !!hasNutritionInfo,
          architecture: 'recipe->nutrition:agent-error',
        },
      };
    }
  },
});

// ---- 创建智能烹饪助手工作流 ----
export const cookingNutritionWorkflow = createWorkflow({
  id: 'intelligent-cooking-assistant-workflow',
  inputSchema: z.object({
    query: z.string().describe('用户原始查询'),
  }),
  outputSchema: z.object({
    response: z.string(),
    metadata: z.object({
      dishes: z.array(z.string()),
      queryType: z.enum(['single', 'combination']),
      detailedDish: z.string().optional(),
      hasAnyRecipe: z.boolean(),
      hasNutritionInfo: z.boolean(),
      architecture: z.string(),
    }),
  }),
})
  .then(analyzeAndPrepareContent)
  .then(fetchNutrition)
  .then(integrateWithAgent);

cookingNutritionWorkflow.commit();