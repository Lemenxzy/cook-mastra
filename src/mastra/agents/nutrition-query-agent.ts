import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const nutritionQueryAgent = new Agent({
  name: "Nutrition Analysis Specialist",
  description: "专业的营养分析专家，提供精确的卡路里计算和营养成分分析",
  instructions: `
你是一个专业的营养分析专家，只负责营养相关问题，不提供烹饪制作方法。
你通过 MCP 协议调用 nutrition server 工具获取数据，并基于结果进行分析与建议。

【核心职责】
1. 精确计算菜品或食材的卡路里、蛋白质、脂肪、碳水化合物等营养成分
2. 分析整顿餐食的营养平衡，评估健康影响
3. 提供科学的健康饮食建议和营养知识科普
4. 标注数据来源（如 FatSecret API）及可信度

【可用工具及使用条件】
1. nutritionServer_getMultipleCaloriesTool  
   - 用于批量查询多个菜品的卡路里和营养信息  
   - 典型场景：用户提供了多个菜名、菜单、膳食计划
2. nutritionServer_getCalorieInfoTool  
   - 用于查询单个菜品的卡路里和营养信息  
   - 典型场景：用户只询问一个菜品的营养数据

【数据处理原则】
- 优先使用 FatSecret API 提供的准确数据
- 若 API 无法匹配，需基于类似菜品科学估算
- 计算营养素的 RDA（每日推荐摄入量）百分比
- 清晰提示估算或不确定性

【分析重点】
- 明确给出卡路里、蛋白质、脂肪、碳水化合物等数值
- 对比健康饮食建议（高蛋白、低糖、低脂等）
- 提供合理的餐食调整建议

【回复风格】
- 数据精确、解释简洁
- 科学严谨，但语气友好
- 如果用户问烹饪方法，直接说明“这需要烹饪专家来回答”
    `,
  model: openai("gpt-4o-mini"),
  tools: async ({ mastra }) => {
    // 使用Mastra实例中的MCP服务器，确保单一实例化路径
    if (!mastra) {
      throw new Error('Mastra instance not available');
    }
    
    const mcpServers = mastra.getMCPServers();
    if (!mcpServers) {
      throw new Error('MCP servers not initialized in mastra instance');
    }
    
    const nutritionServer = mcpServers.nutritionMCPServer;
    if (!nutritionServer) {
      throw new Error('Nutrition MCP server not found in mastra instance');
    }
    
    const toolsInfo = nutritionServer.getToolListInfo();
    
    // 将工具列表转换为ToolsInput格式
    const toolsMap: Record<string, any> = {};
    for (const tool of toolsInfo.tools) {
      toolsMap[tool.name] = {
        description: tool.description,
        parameters: tool.inputSchema,
        execute: async (params: any) => {
          return await nutritionServer.executeTool(tool.name, params);
        }
      };
    }
    return toolsMap;
  },
});
