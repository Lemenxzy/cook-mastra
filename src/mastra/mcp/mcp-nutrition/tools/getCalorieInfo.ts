import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { CalorieInfo } from "../types";
import { getFatSecretAPI } from "../utils/fatSecretApi";
import { getFatSecretOAuth2Client } from "../auth/oauth2";

// 工厂函数，用于创建查询卡路里信息的工具
export function createGetCalorieInfoTool() {
  return createTool({
    id: "getCalorieInfo",
    description: "查询菜品的卡路里和营养信息，支持中英文菜名",
    inputSchema: z.object({
      dishName: z.string().describe("菜品名称，如'宫保鸡丁'、'Kung Pao Chicken'"),
      includeNutrition: z.boolean().optional().default(true).describe("是否包含详细营养信息"),
    }),
    outputSchema: z.object({
      dish_name: z.string(),
      matched_food: z.string().optional(),
      calories_per_serving: z.number().optional(),
      nutrition_info: z.object({
        calories: z.number(),
        carbohydrate: z.number(),
        protein: z.number(),
        fat: z.number(),
        fiber: z.number(),
        sugar: z.number(),
        sodium: z.number(),
        cholesterol: z.number(),
        saturated_fat: z.number(),
        polyunsaturated_fat: z.number(),
        monounsaturated_fat: z.number(),
      }).optional(),
      source: z.enum(['fatsecret', 'estimate']),
      confidence: z.enum(['high', 'medium', 'low']),
      message: z.string(),
    }),
    execute: async ({ context }) => {
      try {
        const { dishName, includeNutrition } = context;

        // 检查认证状态
        try {
          const oauth2Client = getFatSecretOAuth2Client();
          if (!oauth2Client.isAuthenticated()) {
            await oauth2Client.getAuthHeaders(); // This will refresh token if needed
          }
        } catch (authError) {
          console.warn('OAuth2认证失败，使用估算模式:', authError);
          return createEstimatedResponse(dishName, '无法连接到FatSecret API，提供估算数据');
        }

        const fatSecretAPI = getFatSecretAPI();


        // 搜索营养信息
        const nutritionResult = await fatSecretAPI.searchFoodAndGetNutrition(
          dishName
        );

        if (nutritionResult) {
          const response: CalorieInfo = {
            dish_name: dishName,
            matched_food: nutritionResult.matchedFood,
            calories_per_serving: nutritionResult.nutritionInfo.calories,
            source: 'fatsecret',
            confidence: nutritionResult.confidence,
            message: `找到匹配食品"${nutritionResult.matchedFood}"，置信度：${nutritionResult.confidence}`
          };

          if (includeNutrition) {
            response.nutrition_info = nutritionResult.nutritionInfo;
          }

          return response;
        } else {
          // 如果API搜索失败，使用估算
          return createEstimatedResponse(dishName, '未找到匹配的食品，提供估算数据');
        }

      } catch (error) {
        console.error('Get calorie info failed:', error);
        return createEstimatedResponse(
          context.dishName, 
          `查询过程中出现错误: ${error instanceof Error ? error.message : '未知错误'}，提供估算数据`
        );
      }
    },
  });
}

// 检查是否包含中文字符
function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}


// 创建估算响应
function createEstimatedResponse(dishName: string, message: string): CalorieInfo {
  const estimatedCalories = getSimpleCalorieEstimate(dishName);
  
  return {
    dish_name: dishName,
    calories_per_serving: estimatedCalories,
    nutrition_info: {
      calories: estimatedCalories,
      carbohydrate: Math.round(estimatedCalories * 0.5 / 4), // 50%来自碳水化合物，4卡/克
      protein: Math.round(estimatedCalories * 0.25 / 4),     // 25%来自蛋白质，4卡/克
      fat: Math.round(estimatedCalories * 0.25 / 9),         // 25%来自脂肪，9卡/克
      fiber: 3,
      sugar: 8,
      sodium: 400,
      cholesterol: 15,
      saturated_fat: 3,
      polyunsaturated_fat: 2,
      monounsaturated_fat: 3
    },
    source: 'estimate',
    confidence: 'low',
    message
  };
}

// 简单的卡路里估算算法
function getSimpleCalorieEstimate(dishName: string): number {
  const name = dishName.toLowerCase();
  
  // 基于菜名的简单分类
  if (name.includes('沙拉') || name.includes('salad') || name.includes('蔬菜')) return 80;
  if (name.includes('汤') || name.includes('soup')) return 60;
  if (name.includes('鸡') || name.includes('chicken')) return 200;
  if (name.includes('鱼') || name.includes('fish')) return 180;
  if (name.includes('牛肉') || name.includes('beef')) return 250;
  if (name.includes('猪肉') || name.includes('pork')) return 220;
  if (name.includes('虾') || name.includes('shrimp')) return 160;
  if (name.includes('米饭') || name.includes('rice')) return 150;
  if (name.includes('面条') || name.includes('noodles')) return 200;
  if (name.includes('炒') || name.includes('fried')) return 280;
  if (name.includes('红烧') || name.includes('braised')) return 300;
  if (name.includes('糖醋') || name.includes('sweet')) return 350;
  if (name.includes('蛋糕') || name.includes('cake')) return 400;
  
  return 180; // 默认估算
}