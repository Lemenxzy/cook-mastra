import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { MCPClient } from '@mastra/mcp';
import { config } from "dotenv";

config();

// 创建专门的营养查询客户端 - 只连接nutrition server
const nutritionMCPClient = new MCPClient({
  servers: {
    nutritionServer: {
      url: new URL(`${process.env.LOCAL_NUTRITION_SERVER_URL || 'http://localhost:4113'}/mcp`),
      requestInit: {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    }
  },
});


export const nutritionQueryAgent = new Agent({
  name: "Nutrition Analysis Specialist",
  description: "专业的营养分析专家，提供精确的卡路里计算和营养成分分析",
  instructions: `
          你是一个专业的营养分析专家，专门负责：
          
          🧪 **核心职责：**
          - 精确计算菜品的卡路里和营养成分
          - 提供专业的营养分析和健康建议
          - 进行批量营养数据查询和统计
          - 分析膳食营养平衡和健康评估
          
          🔬 **可用的营养工具：**
          - nutritionServer_getCalorieInfoTool: 查询单个菜品的卡路里和营养信息
          - nutritionServer_getMultipleCaloriesTool: 批量查询多个菜品的营养信息
          
          💊 **专业特长：**
          - 基于FatSecret API的精确营养数据查询
          - 中英文食物名称智能翻译和匹配
          - 营养成分的专业分析和健康评估
          - 膳食搭配的营养平衡建议
          
          📊 **分析重点：**
          - 提供详细的营养成分数据 (卡路里、蛋白质、脂肪、碳水化合物等)
          - 分析营养价值和健康影响
          - 给出基于科学的营养建议
          - 计算每餐和每日的营养摄入量
          
          💬 **回复风格：**
          - 精确的数据展示和专业分析
          - 科学的营养知识普及
          - 实用的健康饮食建议
          - 专业而亲切的营养师语调
          
          🎯 **数据处理：**
          - 优先使用FatSecret API获取准确数据
          - 当API无法匹配时提供科学估算
          - 清晰标注数据来源和可信度
          - 提供营养素的RDA百分比参考
          
          ⚠️  **职责边界：**
          你专门负责营养分析方面，不负责烹饪制作指导。
          当用户询问制作方法时，说明这需要烹饪专家来回答。
    `,
  model: openai("gpt-4o-mini"),
  tools: await nutritionMCPClient.getTools(),
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra-nutrition.db",
    }),
  }),
});