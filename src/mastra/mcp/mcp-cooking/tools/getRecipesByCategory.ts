import { z } from "zod";
import { createTool } from '@mastra/core/tools';
import { Recipe, SimpleRecipe } from "../types";
import { simplifyRecipe } from "../utils/recipeUtils";
import { fetchRecipes, getAllCategories } from "../data/recipes";

// 工厂函数，用于创建带有初始数据的工具
export function createGetRecipesByCategoryTool(initFoodData?: { recipes: Recipe[], categories: string[] }) {
  return createTool({
    id: "getRecipesByCategory",
    description: "根据分类查询菜谱，返回该分类下的所有菜谱",
    inputSchema: z.object({
      category: z.string().describe("菜谱分类名称，如水产、早餐、荤菜、主食等"),
      limit: z.number().optional().describe("限制返回的菜谱数量"),
    }),
    outputSchema: z.object({
      recipes: z.any().optional(),
      category: z.string().optional(),
      total: z.number().optional(),
      availableCategories: z.any().optional(),
      message: z.string().optional(),
    }),
    execute: async ({ context }) => {
      try {
        // 优先使用缓存的初始数据，避免重复网络请求
        let recipes: Recipe[];
        let categories: string[];

        if (initFoodData?.recipes && initFoodData?.categories) {
          // 使用预加载的缓存数据
          recipes = initFoodData.recipes;
          categories = initFoodData.categories;
          console.log(
            `使用缓存数据: ${recipes.length} 个菜谱，${categories.length} 个分类`
          );
        } else {
          console.warn("缓存数据不可用，重新获取数据...");
          // 只有在缓存不可用时才重新获取
          recipes = await fetchRecipes();
          categories = getAllCategories(recipes);
        }

        const { category, limit } = context;
        console.log("当前查询的分类:", category, categories, limit, "分类");

        // 检查分类是否存在
        if (!categories.includes(category)) {
          return {
            recipes: [],
            category,
            total: 0,
            availableCategories: categories,
            message: `分类"${category}"不存在。可用分类: ${categories.join(
              ", "
            )}`,
          };
        }
        console.log("可用分类:", categories);

        // 过滤指定分类的菜谱
        let filteredRecipes = recipes.filter(
          (recipe) => recipe.category === category
        );

        // 应用限制
        if (limit) {
          filteredRecipes = filteredRecipes.slice(0, limit);
        }

        // 返回简化版的菜谱数据
        const simplifiedRecipes: SimpleRecipe[] =
          filteredRecipes.map(simplifyRecipe);

        return {
          recipes: simplifiedRecipes,
          category,
          total: recipes.filter((r) => r.category === category).length,
          availableCategories: categories,
          message: `成功获取"${category}"分类下的${simplifiedRecipes.length}个菜谱`,
        };
      } catch (error) {
        return {
          recipes: [],
          category: context.category,
          total: 0,
          availableCategories: [],
          message: `获取菜谱失败: ${
            error instanceof Error ? error.message : "未知错误"
          }`,
        };
      }
    },
  });
}

