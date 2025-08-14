import { createStep } from "@mastra/core/workflows";
import { step1OutputSchema, step2OutputSchema } from "../types";

/**
 * Step 2: 营养信息分析
 * 
 * 功能：
 * - 只对详细展示的菜品进行营养分析（而非所有识别的菜品）
 * - 单菜查询：分析主要菜品的营养信息
 * - 组合推荐：只分析detailedDish（详细展开的主菜）的营养信息
 * - 透传所有必要的上下文信息
 */
export const fetchNutrition = createStep({
  id: "fetch-nutrition",
  description: "对详细展示的菜品进行精准营养分析，避免查询不必要的候选菜品",
  inputSchema: step1OutputSchema,
  outputSchema: step2OutputSchema,
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
      // 未命中菜谱：不查营养，直接透传
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
      // 优化的营养查询策略：只查询需要详细展示的菜品
      let targetDish: string;
      
      if (queryType === 'combination') {
        // 组合推荐：只查询详细展开的主菜
        if (!detailedDish) {
          console.warn("组合推荐但无详细菜品，跳过营养查询");
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
        targetDish = detailedDish;
      } else {
        // 单菜查询：查询主要菜品（通常是第一个）
        if (identifiedDishes.length === 0) {
          console.warn("单菜查询但无识别菜品，跳过营养查询");
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
        targetDish = identifiedDishes[0]; // 取第一个作为主菜
      }
      
      const prompt = `请给出 "${targetDish}" 的营养信息（至少包含每份的卡路里、蛋白质、脂肪、碳水化合物）。如果份量未指定，请以常见标准份量假设，并在结果中说明假设。`;

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