import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { Recipe } from "../types";
import { fetchRecipes } from "../data/recipes";

// 工厂函数，用于创建带有初始数据的工具
export function createGetRecipeByIdTool(initFoodData?: { recipes: Recipe[], categories: string[] }) {
  return createTool({
    id: "getRecipeById",
    description: "根据菜谱名称或ID查询指定菜谱的完整详情，包括食材、步骤等",
    inputSchema: z.object({
      query: z.string().describe("菜谱名称或ID，支持模糊匹配菜谱名称"),
    }),
    outputSchema: z.object({
      recipe: z.any().optional(),
      possibleMatches: z.any().optional(),
      message: z.string(),
    }),
    execute: async ({ context }) => {
      try {
        // 优先使用缓存的初始数据
        let recipes: Recipe[];
        if (initFoodData?.recipes && initFoodData.recipes.length > 0) {
          recipes = initFoodData.recipes;
          console.log(`使用缓存数据: ${recipes.length} 个菜谱`);
        } else {
          console.warn("缓存数据不可用，重新获取数据...");
          recipes = await fetchRecipes();
        }
        const { query } = context;
        
        // 首先尝试精确匹配ID
        let foundRecipe = recipes.find((recipe) => recipe.id === query);

        // 如果没有找到，尝试精确匹配名称
        if (!foundRecipe) {
          foundRecipe = recipes.find((recipe) => recipe.name === query);
        }

        // 如果还没有找到，尝试模糊匹配名称
        if (!foundRecipe) {
          foundRecipe = recipes.find((recipe) =>
            recipe.name.toLowerCase().includes(query.toLowerCase())
          );
        }
        console.log("foundRecipe ====>", foundRecipe, query);

        // 如果仍然没有找到，返回所有可能的匹配项（最多5个）
        if (!foundRecipe) {
          const possibleMatches = recipes
            .filter(
              (recipe) =>
                recipe.name.toLowerCase().includes(query.toLowerCase()) ||
                recipe.description.toLowerCase().includes(query.toLowerCase())
            )
            .slice(0, 5);

          if (possibleMatches.length === 0) {
            return {
              recipe: null,
              message: `未找到匹配"${query}"的菜谱，请检查菜谱名称是否正确，或尝试使用关键词搜索`,
            };
          }

          return {
            recipe: null,
            possibleMatches: possibleMatches.map((recipe) => ({
              id: recipe.id,
              name: recipe.name,
              description: recipe.description,
              category: recipe.category,
            })),
            message: `未找到精确匹配"${query}"的菜谱，以下是${possibleMatches.length}个可能的匹配项`,
          };
        }

        // 返回找到的完整菜谱信息
        return {
          recipe: foundRecipe,
          message: `成功找到菜谱: ${foundRecipe.name}`,
        };
      } catch (error) {
        return {
          recipe: null,
          message: `查询菜谱失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`,
        };
      }
    },
  });
}

