import { createStep } from "@mastra/core/workflows";
import { step2OutputSchema, finalOutputSchema } from "../types";

/**
 * Step 3: Agent智能整合输出
 * 
 * 功能：
 * - 调用专门的总结Agent
 * - 智能整合烹饪信息和营养数据
 * - 推荐其他相关菜品给用户
 * - 生成用户友好的最终回复
 * - 确保营养数据来源标注和菜谱匹配状态告知
 */
export const integrateWithAgent = createStep({
  id: 'integrate-with-agent',
  description: '调用专门的总结Agent，智能整合烹饪信息和营养数据，生成用户友好的最终回复',
  inputSchema: step2OutputSchema,
  outputSchema: finalOutputSchema,
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
      // 计算其他可推荐的菜品
      const otherDishes = identifiedDishes.filter(dish => dish !== detailedDish);
      
      const contextPrompt = `请整合以下信息，生成用户友好的回复：

**用户查询**: "${originalQuery}"
**查询类型**: ${queryType === 'single' ? '单菜查询' : '组合推荐'}
**菜谱匹配状态**: ${hasAnyRecipe ? '已找到菜谱' : '未找到菜谱'}
**识别到的菜品**: ${identifiedDishes.length > 0 ? identifiedDishes.join('、') : '无'}
**详细展示菜品**: ${detailedDish || '无'}
**其他相关菜品**: ${otherDishes.length > 0 ? otherDishes.join('、') : '无'}

${hasAnyRecipe && cookingInfoRaw ? `**烹饪信息**:\n${cookingInfoRaw}` : ''}

${!hasAnyRecipe && approxMethod ? `**大致做法**:\n${approxMethod}` : ''}

${candidates && candidates.length > 0 ? `**候选建议**: ${candidates.join('、')}` : ''}

**营养信息状态**: ${hasNutritionInfo ? '已获取' : '未获取'}
${hasNutritionInfo && nutritionInfo ? `**营养分析结果**:\n${nutritionInfo}` : ''}

请生成完整的回复，务必：
1. 明确告知用户菜谱匹配结果
2. 如有营养信息，标注"以上营养数据由AI营养分析系统提供，仅供参考"
3. 如有其他相关菜品，在回复末尾自然地推荐给用户（如"您还可以尝试：菜名1、菜名2"）
4. 提供实用的建议和指导`;

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