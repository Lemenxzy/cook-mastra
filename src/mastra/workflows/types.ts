import { z } from "zod";

// 共享的Schema定义

// Step 1 输出Schema
export const step1OutputSchema = z.object({
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
});

// Step 2 输出Schema
export const step2OutputSchema = z.object({
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
});

// 最终输出Schema
export const finalOutputSchema = z.object({
  response: z.string(),
  metadata: z.object({
    dishes: z.array(z.string()),
    queryType: z.enum(['single', 'combination']),
    detailedDish: z.string().optional(),
    hasAnyRecipe: z.boolean(),
    hasNutritionInfo: z.boolean(),
    architecture: z.string(),
  }),
});

// 类型导出
export type Step1Output = z.infer<typeof step1OutputSchema>;
export type Step2Output = z.infer<typeof step2OutputSchema>;
export type FinalOutput = z.infer<typeof finalOutputSchema>;