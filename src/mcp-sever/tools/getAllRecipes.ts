import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { Recipe, NameOnlyRecipe } from "../types";
import { simplifyRecipeNameOnly } from "../utils/recipeUtils";
import { fetchRecipes } from "../data/recipes";

// 工厂函数，用于创建带有初始数据的工具
export function createGetAllRecipesTool(initFoodData?: { recipes: Recipe[], categories: string[] }) {
  return createTool({
    id: "getAllRecipes",
    description: "获取所有菜谱的名称和描述",
    inputSchema: z.object({
      limit: z.number().optional().describe("限制返回的菜谱数量，默认返回所有"),
    }),
    outputSchema: z.object({
      recipes: z.any().optional(),
      total: z.number(),
      message: z.string(),
    }),
    execute: async ({ context }) => {
      try {
        // 优先使用缓存的初始数据，避免重复网络请求
        let recipes: Recipe[];
        console.log(`初始数据: ${initFoodData?.recipes.length || 0} 个菜谱`);
        if (initFoodData?.recipes && initFoodData.recipes.length > 0) {
          // 使用预加载的缓存数据
          recipes = initFoodData.recipes;
          console.log(`使用缓存数据: ${recipes.length} 个菜谱`);
        } else {
          console.warn('缓存数据不可用，重新获取数据...');
          // 只有在缓存不可用时才重新获取
          recipes = await fetchRecipes();
        }
        const limit = context.limit || recipes.length;
        
        // 返回简化版的菜谱数据，只包含name和description
        const simplifiedRecipes: NameOnlyRecipe[] = recipes
          .slice(0, limit)
          .map(simplifyRecipeNameOnly);
        console.log("简化后的菜谱数据:", simplifiedRecipes);
        return {
          recipes: simplifiedRecipes,
          total: recipes.length,
          message: `成功获取${simplifiedRecipes.length}个菜谱（共${recipes.length}个）`,
        };
      } catch (error) {
        return {
          recipes: [],
          total: 0,
          message: `获取菜谱失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`,
        };
      }
    },
  });
}

