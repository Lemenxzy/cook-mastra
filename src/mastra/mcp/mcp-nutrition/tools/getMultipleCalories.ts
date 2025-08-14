import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { RuntimeContext } from '@mastra/core/runtime-context';
import { createGetCalorieInfoTool } from "./getCalorieInfo";

// 批量查询多个菜品的卡路里信息
export function createGetMultipleCaloriesTool() {
  return createTool({
    id: "getMultipleCalories",
    description: "批量查询多个菜品的卡路里信息，适用于整个菜单或膳食计划",
    inputSchema: z.object({
      dishNames: z.array(z.string()).min(1).max(20).describe("菜品名称列表，最多20个"),
      includeNutrition: z.boolean().optional().default(false).describe("是否包含详细营养信息"),
    }),
    outputSchema: z.object({
      results: z.array(z.object({
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
      })),
      summary: z.object({
        total_dishes: z.number(),
        total_calories: z.number(),
        api_queries: z.number(),
        estimated_queries: z.number(),
        average_confidence: z.string(),
      }),
      message: z.string(),
    }),
    execute: async ({ context }) => {
      try {
        const { dishNames, includeNutrition } = context;
        
        console.log(`Batch querying calories for ${dishNames.length} dishes`);
        
        // 创建单个查询工具实例
        const singleQueryTool = createGetCalorieInfoTool();
        
        // 并发查询所有菜品（限制并发数量以避免API限制）
        const batchSize = 3; // 同时查询3个
        const results = [];
        
        for (let i = 0; i < dishNames.length; i += batchSize) {
          const batch = dishNames.slice(i, i + batchSize);
          
          const batchPromises = batch.map((dishName) =>
            singleQueryTool.execute({
              context: {
                dishName,
                includeNutrition,
              },
              runtimeContext: new RuntimeContext(),
            })
          );
          
          const batchResults = await Promise.all(batchPromises);
          results.push(...batchResults);
          
          // 在批次之间短暂延迟，避免API速率限制
          if (i + batchSize < dishNames.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        // 计算汇总统计
        const totalCalories = results.reduce((sum, result) => {
          return sum + (result.calories_per_serving || 0);
        }, 0);
        
        const apiQueries = results.filter(r => r.source === 'fatsecret').length;
        const estimatedQueries = results.filter(r => r.source === 'estimate').length;
        
        // 计算平均置信度
        const confidenceScores = results.map(r => {
          switch (r.confidence) {
            case 'high': return 3;
            case 'medium': return 2;
            case 'low': return 1;
            default: return 1;
          }
        });
        
        const avgConfidenceScore = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
        let averageConfidence = 'low';
        if (avgConfidenceScore > 2.5) averageConfidence = 'high';
        else if (avgConfidenceScore > 1.5) averageConfidence = 'medium';
        
        const summary = {
          total_dishes: dishNames.length,
          total_calories: Math.round(totalCalories),
          api_queries: apiQueries,
          estimated_queries: estimatedQueries,
          average_confidence: averageConfidence
        };
        
        const successRate = ((apiQueries / dishNames.length) * 100).toFixed(1);
        const message = `批量查询完成：${dishNames.length}个菜品，总计${Math.round(totalCalories)}卡路里。API成功率：${successRate}%，平均置信度：${averageConfidence}`;
        
        return {
          results,
          summary,
          message
        };
        
      } catch (error) {
        console.error('Batch calorie query failed:', error);
        
        // 返回失败响应
        const failedResults = context.dishNames.map(dishName => ({
          dish_name: dishName,
          calories_per_serving: 180, // 默认估算
          nutrition_info: context.includeNutrition ? {
            calories: 180,
            carbohydrate: 23,
            protein: 11,
            fat: 5,
            fiber: 3,
            sugar: 8,
            sodium: 400,
            cholesterol: 15,
            saturated_fat: 3,
            polyunsaturated_fat: 2,
            monounsaturated_fat: 3
          } : undefined,
          source: 'estimate' as const,
          confidence: 'low' as const,
          message: '批量查询失败，使用默认估算值'
        }));
        
        return {
          results: failedResults,
          summary: {
            total_dishes: context.dishNames.length,
            total_calories: 180 * context.dishNames.length,
            api_queries: 0,
            estimated_queries: context.dishNames.length,
            average_confidence: 'low'
          },
          message: `批量查询失败: ${error instanceof Error ? error.message : '未知错误'}，所有结果均为估算值`
        };
      }
    },
  });
}