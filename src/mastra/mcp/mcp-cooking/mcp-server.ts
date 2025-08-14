import { MCPServer } from '@mastra/mcp';
import { fetchRecipes, getAllCategories } from './data/recipes';
import { Recipe } from './types';
import { 
  createGetAllRecipesTool,
  createGetRecipesByCategoryTool,
  createGetRecipeByIdTool,
  createRecommendMealsTool,
  createWhatToEatTool
} from './tools';

import { config } from "dotenv";

config();

// 初始化数据
async function initializeData() {
  try {
    console.log('正在加载菜谱数据...');
    let recipesCache: Recipe[] = await fetchRecipes();
    let categoriesCache: string[] = getAllCategories(recipesCache);
    console.log(`成功加载 ${recipesCache.length} 个菜谱，${categoriesCache.length} 个分类`);
    return {
      recipes: recipesCache,
      categories: categoriesCache
    };
  } catch (error) {
    console.error('加载菜谱数据失败:', error);
  }
}

// 创建MCP服务器实例
export async function createCookMCPServer() {
  const initFoodData = await initializeData();

  const server = new MCPServer({
    name: "cooking",
    version: "1.0.0",
    tools: {
      getAllRecipesTool: createGetAllRecipesTool(initFoodData),
      getRecipesByCategoryTool: createGetRecipesByCategoryTool(initFoodData),
      getRecipeByIdTool: createGetRecipeByIdTool(initFoodData),
      recommendMealsTool: createRecommendMealsTool(initFoodData),
      whatToEatTool: createWhatToEatTool(initFoodData),
    },
  });

  return server;
}


