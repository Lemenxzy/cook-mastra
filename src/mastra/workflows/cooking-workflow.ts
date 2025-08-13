import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// 步骤1: 智能意图分析
const analyzeQuery = createStep({
  id: 'analyze-query',
  description: '使用专门的意图分析Agent分析用户查询意图，决定后续流程',
  inputSchema: z.object({
    query: z.string().describe('用户查询'),
  }),
  outputSchema: z.object({
    needsCookingInfo: z.boolean().describe('是否需要烹饪制作信息'),
    needsNutritionInfo: z.boolean().describe('是否需要营养信息'),
    queryType: z.enum(['recipe', 'nutrition', 'recommendation', 'general']),
    priority: z.string().describe('分析优先级'),
    reasoning: z.string().describe('分析推理过程'),
    confidence: z.number().describe('分析置信度'),
    originalQuery: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { query } = inputData;
    console.log(`🎯 开始分析用户意图: "${query}"`);
    
    // 尝试使用专门的意图分析Agent
    const result = await performIntentAnalysis(query, mastra);
    
    // 应用智能fallback策略
    const finalResult = applyFallbackStrategy(result, query);
    
    console.log(`✅ 意图分析完成 - 烹饪:${finalResult.needsCookingInfo ? '✅' : '❌'} 营养:${finalResult.needsNutritionInfo ? '✅' : '❌'} 置信度:${finalResult.confidence}`);
    
    return finalResult;
  },
});

/**
 * 执行意图分析的核心逻辑
 */
async function performIntentAnalysis(query: string, mastra: any) {
  const intentAgent = mastra?.getAgent('intentAnalysisAgent');
  
  if (!intentAgent) {
    console.warn('📍 意图分析Agent不可用，使用关键词分析');
    return performKeywordAnalysis(query, 'Agent不可用');
  }
  
  try {
    const response = await intentAgent.generate([
      {
        role: 'user',
        content: `请分析以下用户查询的意图：

用户查询: "${query}"

请严格按照JSON格式返回分析结果。`
      }
    ]);
    
    return parseAgentResponse(response.text, query);
    
  } catch (error) {
    if (error instanceof Error) {
      console.warn('📍 意图分析Agent调用失败:', error.message);
    } else {
      console.warn('📍 意图分析Agent调用失败:', error);
    }
    return performKeywordAnalysis(query, 'Agent调用异常');
  }
}

/**
 * 解析Agent响应
 */
function parseAgentResponse(responseText: string, query: string) {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('响应中未找到JSON格式');
    }
    
    const analysisResult = JSON.parse(jsonMatch[0]);
    
    // 验证必要字段
    if (typeof analysisResult.needsCookingInfo !== 'boolean' || 
        typeof analysisResult.needsNutritionInfo !== 'boolean') {
      throw new Error('JSON格式不完整');
    }
    
    return {
      needsCookingInfo: analysisResult.needsCookingInfo,
      needsNutritionInfo: analysisResult.needsNutritionInfo,
      queryType: analysisResult.queryType || 'general',
      priority: analysisResult.priority || 'balanced',
      reasoning: analysisResult.reasoning || '意图分析完成',
      confidence: analysisResult.confidence || 0.8,
      originalQuery: query,
      source: 'agent'
    };
    
  } catch (parseError) {
    if (parseError instanceof Error) {
      console.warn('📍 JSON解析失败:', parseError.message);
    } else {
      console.warn('📍 JSON解析失败:', parseError);
    }
    return performKeywordAnalysis(query, 'JSON解析失败');
  }
}

/**
 * 关键词分析fallback
 */
function performKeywordAnalysis(query: string, reason: string) {
  const lowerQuery = query.toLowerCase();
  
  // 关键词模式匹配
  const cookingPatterns = /(?:怎么做|制作|做法|步骤|教程|烹饪|料理|菜谱|推荐)/;
  const nutritionPatterns = /(?:卡路里|热量|营养|脂肪|蛋白质|碳水|健康|减肥|油腻)/;
  
  const hasCookingKeywords = cookingPatterns.test(lowerQuery);
  const hasNutritionKeywords = nutritionPatterns.test(lowerQuery);
  
  // 确定查询类型
  let queryType = 'general';
  if (hasCookingKeywords && hasNutritionKeywords) {
    queryType = 'recommendation';
  } else if (hasCookingKeywords) {
    queryType = 'recipe';
  } else if (hasNutritionKeywords) {
    queryType = 'nutrition';
  }
  
  return {
    needsCookingInfo: hasCookingKeywords,
    needsNutritionInfo: hasNutritionKeywords,
    queryType,
    priority: 'balanced',
    reasoning: `关键词分析(${reason})`,
    confidence: 0.6,
    originalQuery: query,
    source: 'keyword'
  };
}

/**
 * 应用智能fallback策略
 */
function applyFallbackStrategy(result: any, query: string) {
  let { needsCookingInfo, needsNutritionInfo, reasoning, confidence } = result;
  let fallbackApplied = false;
  
  // 策略1: 两个都为false时的处理
  if (!needsCookingInfo && !needsNutritionInfo) {
    console.warn('⚠️ 未识别到明确意图，默认提供制作信息');
    needsCookingInfo = true;
    reasoning += ' [默认制作信息]';
    fallbackApplied = true;
  }
  
  // 策略2: 低置信度的保守策略
  if (confidence < 0.7 && result.source === 'agent') {
    console.warn(`⚠️ 置信度较低(${confidence})，采用保守策略`);
    needsCookingInfo = true;
    needsNutritionInfo = true;
    reasoning += ` [保守策略:${confidence}]`;
    fallbackApplied = true;
  }
  
  // 策略3: 食物相关查询的营养信息增强
  if (needsCookingInfo && !needsNutritionInfo && confidence > 0.8) {
    const foodRelated = /[a-zA-Z\u4e00-\u9fff]{2,}/.test(query) && 
                       !/(?:技巧|方法|窍门|秘诀)/.test(query.toLowerCase());
    if (foodRelated) {
      console.log('💡 检测到具体食物查询，建议添加营养信息');
      needsNutritionInfo = true;
      reasoning += ' [增强营养信息]';
    }
  }
  
  if (fallbackApplied) {
    console.log(`🛡️ Fallback策略已应用: ${reasoning}`);
  }
  
  return {
    ...result,
    needsCookingInfo,
    needsNutritionInfo,
    reasoning,
    confidence: fallbackApplied ? Math.max(confidence, 0.7) : confidence
  };
}

// 步骤2: 调用烹饪制作Agent
const getCookingInfo = createStep({
  id: "get-cooking-info",
  description: "调用烹饪制作Agent获取菜谱和制作步骤",
  inputSchema: z.object({
    needsCookingInfo: z.boolean(),
    needsNutritionInfo: z.boolean(),
    queryType: z.enum(['recipe', 'nutrition', 'recommendation', 'general']),
    priority: z.string(),
    reasoning: z.string(),
    confidence: z.number(),
    originalQuery: z.string(),
  }),
  outputSchema: z.object({
    cookingInfo: z.string().optional(),
    hasCookingInfo: z.boolean(),
    identifiedDishes: z
      .array(z.string())
      .optional()
      .describe("从查询中识别出的菜品名称"),
    originalQuery: z.string(),
    needsNutritionInfo: z.boolean(),
    queryType: z.enum(['recipe', 'nutrition', 'recommendation', 'general']),
    priority: z.string(),
    reasoning: z.string(),
    confidence: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { needsCookingInfo, originalQuery, needsNutritionInfo, queryType, priority, reasoning, confidence } = inputData;

    if (!needsCookingInfo) {
      return { 
        hasCookingInfo: false, 
        identifiedDishes: [],
        originalQuery,
        needsNutritionInfo,
        queryType,
        priority,
        reasoning,
        confidence
      };
    }

    const cookingAgent = mastra?.getAgent("cookingProcessAgent");
    if (!cookingAgent) {
      console.warn("烹饪制作Agent未找到，跳过烹饪信息查询");
      return { 
        hasCookingInfo: false, 
        identifiedDishes: [],
        originalQuery,
        needsNutritionInfo,
        queryType,
        priority,
        reasoning,
        confidence
      };
    }

    try {

      const response = await cookingAgent.generate([
        {
          role: "user",
          content: `用户询问: "${originalQuery}"
          
请分析这个查询并：
1. 提供详细的制作步骤和烹饪技巧
2. 在回复开头用JSON格式列出识别到的菜品名称：{"dishes": ["菜品1", "菜品2"]}

专注于提供准确的菜谱信息和实用的烹饪建议。`,
        },
      ]);
      console.log("dishes ====>", response.text);
      // 尝试从响应中提取菜品名称
      let identifiedDishes: string[] = [];
      try {
        const dishMatch = response.text.match(/\{"dishes":\s*\[(.*?)\]\}/);
        if (dishMatch) {
          const dishesStr = dishMatch[1];
          identifiedDishes = dishesStr
            .split(",")
            .map((d) => d.trim().replace(/"/g, ""));
        }
      } catch (error) {
        console.warn("⚠️ 无法从烹饪Agent响应中提取菜品名称:", error);
      }

      console.log(
        `✅ 烹饪信息获取成功，识别菜品: ${
          identifiedDishes.length > 0 ? identifiedDishes.join("、") : "无"
        }`
      );

      return {
        cookingInfo: response.text,
        hasCookingInfo: true,
        identifiedDishes,
        originalQuery,
        needsNutritionInfo,
        queryType,
        priority,
        reasoning,
        confidence
      };
    } catch (error) {
      console.error("❌ 调用烹饪制作Agent失败:", error);
      // 保证返回类型一致
      return {
        hasCookingInfo: false,
        identifiedDishes: [],
        originalQuery,
        needsNutritionInfo,
        queryType,
        priority,
        reasoning,
        confidence
      };
    }
  },
});

// 步骤3: 调用营养查询Agent
const getNutritionInfo = createStep({
  id: 'get-nutrition-info',
  description: '调用营养查询Agent获取卡路里和营养信息', 
  inputSchema: z.object({
    cookingInfo: z.string().optional(),
    hasCookingInfo: z.boolean(),
    identifiedDishes: z.array(z.string()).optional(),
    originalQuery: z.string(),
    needsNutritionInfo: z.boolean(),
    queryType: z.enum(['recipe', 'nutrition', 'recommendation', 'general']),
    priority: z.string(),
    reasoning: z.string(),
    confidence: z.number(),
  }),
  outputSchema: z.object({
    nutritionInfo: z.string().optional(),
    hasNutritionInfo: z.boolean(),
    cookingInfo: z.string().optional(),
    hasCookingInfo: z.boolean(),
    identifiedDishes: z.array(z.string()).optional(),
    originalQuery: z.string(),
    queryType: z.enum(['recipe', 'nutrition', 'recommendation', 'general']),
    priority: z.string(),
    reasoning: z.string(),
    confidence: z.number(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { 
      needsNutritionInfo, 
      identifiedDishes, 
      originalQuery, 
      cookingInfo, 
      hasCookingInfo,
      queryType,
      priority,
      reasoning,
      confidence
    } = inputData;
    
    // 使用从烹饪Agent识别出的菜品
    const targetDishes = identifiedDishes || [];
    
    if (!needsNutritionInfo) {
      return { 
        hasNutritionInfo: false,
        cookingInfo,
        hasCookingInfo,
        identifiedDishes,
        originalQuery,
        queryType,
        priority,
        reasoning,
        confidence
      };
    }
    console.log(`🍏 开始营养信息查询，识别菜品: ${targetDishes.length > 0 ? targetDishes.join('、') : '无'}`);
    
    // 如果没有识别到具体菜品，但查询明显需要营养信息，尝试从查询中提取
    if (targetDishes.length === 0) {
      // 对于没有具体菜品的营养查询，仍然可以调用营养Agent
      console.log('未识别到具体菜品，但仍需营养分析');
    }
    
    const nutritionAgent = mastra?.getAgent('nutritionQueryAgent');
    if (!nutritionAgent) {
      console.warn('营养查询Agent未找到，跳过营养信息查询');
      return { 
        hasNutritionInfo: false,
        cookingInfo,
        hasCookingInfo,
        identifiedDishes,
        originalQuery,
        queryType,
        priority,
        reasoning,
        confidence
      };
    }
    
    try {
      let nutritionPrompt: string;
      if (targetDishes.length === 1) {
        nutritionPrompt = `请分析"${targetDishes[0]}"的营养成分，包括卡路里、蛋白质、脂肪、碳水化合物等详细信息。`;
      } else if (targetDishes.length > 1) {
        nutritionPrompt = `请分析以下菜品的营养成分: ${targetDishes.join('、')}。提供每道菜的卡路里和主要营养数据。`;
      } else {
        // 没有具体菜品时，让营养Agent分析原始查询
        nutritionPrompt = `用户查询: "${originalQuery}"\n\n请分析这个查询中可能涉及的食品营养信息，提供相关的营养建议。`;
      }
      
      const response = await nutritionAgent.generate([
        {
          role: 'user',
          content: nutritionPrompt
        }
      ]);
      
      return {
        nutritionInfo: response.text,
        hasNutritionInfo: true,
        cookingInfo,
        hasCookingInfo,
        identifiedDishes,
        originalQuery,
        queryType,
        priority,
        reasoning,
        confidence
      };
    } catch (error) {
      console.error('调用营养查询Agent失败:', error);
      return { 
        hasNutritionInfo: false,
        cookingInfo,
        hasCookingInfo,
        identifiedDishes,
        originalQuery,
        queryType,
        priority,
        reasoning,
        confidence
      };
    }
  },
});

// 步骤4: 整合响应
const integrateResponse = createStep({
  id: 'integrate-response',
  description: '整合烹饪和营养信息，生成完整回复',
  inputSchema: z.object({
    originalQuery: z.string(),
    identifiedDishes: z.array(z.string()).optional(),
    cookingInfo: z.string().optional(),
    hasCookingInfo: z.boolean(),
    nutritionInfo: z.string().optional(), 
    hasNutritionInfo: z.boolean(),
    queryType: z.enum(['recipe', 'nutrition', 'recommendation', 'general']),
    priority: z.string(),
    reasoning: z.string(),
    confidence: z.number(),
  }),
  outputSchema: z.object({
    response: z.string(),
    metadata: z.object({
      dishNames: z.array(z.string()),
      hasCookingInfo: z.boolean(),
      hasNutritionInfo: z.boolean(),
      reasoning: z.string(),
      architecture: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    const { originalQuery, identifiedDishes, cookingInfo, hasCookingInfo, nutritionInfo, hasNutritionInfo, queryType, priority, reasoning, confidence } = inputData;
    
    // 使用实际识别出的菜品名称
    const finalDishNames = identifiedDishes || [];
    
    // 如果只有一种信息，直接返回
    if (cookingInfo && !nutritionInfo) {
      return {
        response: cookingInfo,
        metadata: { dishNames: finalDishNames, hasCookingInfo, hasNutritionInfo, reasoning, architecture: 'triple-agent-workflow' }
      };
    }
    if (nutritionInfo && !cookingInfo) {
      return {
        response: nutritionInfo,
        metadata: { dishNames: finalDishNames, hasCookingInfo, hasNutritionInfo, reasoning, architecture: 'triple-agent-workflow' }
      };
    }
    if (!cookingInfo && !nutritionInfo) {
      // 尝试提供通用的烹饪建议
      const fallbackResponse = `关于您的查询"${originalQuery}"，虽然暂时无法获取具体信息，但我可以为您提供一些通用建议：

🍳 **烹饪小贴士：**
- 注意火候控制，避免过度烹饪
- 适当调味，可根据个人口味调整
- 食材新鲜度很重要，建议选择当季食材

📋 **建议：**
- 您可以尝试更具体地描述您想了解的菜品或问题
- 如果询问特定菜品，可以提供菜品名称
- 如果需要营养信息，可以明确说明

如需更详细的帮助，请重新描述您的需求。`;

      return {
        response: fallbackResponse,
        metadata: { dishNames: finalDishNames, hasCookingInfo, hasNutritionInfo, reasoning: reasoning + ' [已应用最终fallback策略]', architecture: 'triple-agent-workflow' }
      };
    }
    
    // 整合两种信息
    let integratedResponse = `针对您的查询"${originalQuery}"，这里是完整的信息：\n\n`;
    
    if (cookingInfo) {
      integratedResponse += `## 🍳 制作指导\n${cookingInfo}\n\n`;
    }
    
    if (nutritionInfo) {
      integratedResponse += `## 📊 营养分析\n${nutritionInfo}\n\n`;
    }
    
    // 添加总结
    if (finalDishNames.length > 0) {
      integratedResponse += `## 💡 综合建议\n`;
      integratedResponse += `以上为您提供了${finalDishNames.join('、')}的完整信息，包括详细制作步骤和营养分析。`;
      integratedResponse += `建议您在制作时注意火候控制，同时关注营养搭配的平衡。祝您烹饪愉快！🎉`;
    }
    
    return {
      response: integratedResponse,
      metadata: { dishNames: finalDishNames, hasCookingInfo, hasNutritionInfo, reasoning, architecture: 'triple-agent-workflow' }
    };
  },
});

// 创建工作流 - 这就是我们的"协调器"
export const cookingWorkflow = createWorkflow({
  id: 'cooking-triple-agent-workflow',
  inputSchema: z.object({
    query: z.string().describe('用户烹饪查询'),
  }),
  outputSchema: z.object({
    response: z.string(),
    metadata: z.object({
      dishNames: z.array(z.string()),
      hasCookingInfo: z.boolean(),
      hasNutritionInfo: z.boolean(),
      reasoning: z.string(),
      architecture: z.string(),
    }),
  }),
})
  .then(analyzeQuery)
  .then(getCookingInfo)
  .then(getNutritionInfo)
  .then(integrateResponse);

cookingWorkflow.commit();