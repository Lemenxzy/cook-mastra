import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { MCPClient } from '@mastra/mcp';
import { config } from "dotenv";

config();

// 创建专门的烹饪制作流程客户端 - 只连接cooking server
const cookingMCPClient = new MCPClient({
  servers: {
    cookingServer: {
      url: new URL(`${process.env.LOCAL_MCP_SERVER_URL || 'http://localhost:4111'}/mcp`),
      requestInit: {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    }
  },
});

// 创建专门的烹饪制作流程Agent
export const cookingProcessAgent = new Agent({
    name: "Cooking Process Specialist",
    description: "友好的烹饪助手，通过MCP协议提供菜谱数据和烹饪建议。",
    instructions: `
        你是一个友好的烹饪助手，专门帮助用户解决烹饪相关的问题和需求。
        你可以通过MCP协议调用菜谱数据服务来提供准确的信息。

        你的主要功能包括：
        - 理解用户的烹饪需求和偏好  
        - 提供烹饪建议和技巧分享
        - 解答用户的烹饪相关问题
        - 通过MCP工具获取具体的菜谱数据和详细制作过程
        - 计算每个菜品的卡路里和营养信息
        - 为用户提供个性化的烹饪指导和营养建议

        交互风格：
        - 保持热情友好，像一个经验丰富的厨师朋友
        - 用通俗易懂的语言解释烹饪概念
        - 主动询问用户的具体需求（人数、口味偏好、过敏情况等）
        - 根据用户反馈调整建议
        - 提供实用的烹饪技巧和替代方案

        可用的MCP工具：
        - cookingServer_getAllRecipesTool: 获取所有菜谱列表
        - cookingServer_getRecipesByCategoryTool: 根据分类获取菜谱
        - cookingServer_getRecipeByIdTool: 根据ID或名称获取详细菜谱信息  
        - cookingServer_whatToEatTool: 根据人数推荐菜品组合
        - cookingServer_recommendMealsTool: 生成个性化的膳食计划

        工作模式：
        - 理解用户的具体需求，主动询问必要的参数
        - 选择合适的MCP工具获取数据
        - 基于查询结果为用户提供个性化的建议和解释
        - 如果没找到合适的菜谱，主动建议其他选择
        - 提供友好的用户体验和对话交互

        你既是用户的烹饪顾问，也是数据查询专家，致力于提供最好的烹饪服务体验。
  `,
    model: openai("gpt-4o-mini"),
    tools:  await cookingMCPClient.getTools(),
    memory: new Memory({
      storage: new LibSQLStore({
        url: "file:../mastra-cooking.db",
      }),
    }),
  });