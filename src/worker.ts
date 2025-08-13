import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { mastra } from './mastra';
import { getMCPEnvironmentInfo } from './mcp-sever';

type Env = {
  NODE_ENV?: string;
  MCP_SERVER_URL?: string;
  OPENAI_API_KEY?: string;
};

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for frontend access
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/', (c) => {
  const mcpInfo = getMCPEnvironmentInfo();
  
  return c.json({ 
    message: 'Cook-Mastra API 正在运行！', 
    timestamp: new Date().toISOString(),
    environment: mcpInfo,
    endpoints: {
      '/api/recipes/search': 'POST - 搜索食谱',
      '/api/recipes/details': 'POST - 获取食谱详情',
      '/api/menu/weekly': 'POST - 获取每周菜单',
      '/api/meal/random': 'POST - 获取随机餐点推荐',
      '/api/chat': 'POST - 与烹饪助手聊天',
      '/api/workflow/cooking': 'POST - 执行烹饪工作流',
      '/api/debug/mcp': 'GET - MCP连接调试信息'
    }
  });
});

// MCP调试端点
app.get('/api/debug/mcp', async (c) => {
  try {
    const mcpInfo = getMCPEnvironmentInfo();
    const agent = mastra.getAgent('cookingAgent');
    
    return c.json({
      success: true,
      mcpEnvironment: mcpInfo,
      agentAvailable: !!agent,
      timestamp: new Date().toISOString(),
      message: 'MCP调试信息'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      mcpEnvironment: getMCPEnvironmentInfo(),
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Recipe search endpoint
app.post('/api/recipes/search', async (c) => {
  try {
    const { query, category } = await c.req.json();
    
    const agent = mastra.getAgent('cookingAgent');
    if (!agent) {
      return c.json({ error: '烹饪助手不可用' }, 500);
    }

    const response = await agent.generate([{
      role: 'user',
      content: `搜索食谱: "${query}"${category ? `，类别: ${category}` : ''}。请使用可用的MCP工具来搜索食谱。`
    }]);

    return c.json({
      success: true,
      data: response.object,
      message: 'Recipes found successfully'
    });
  } catch (error) {
    console.error('Recipe search error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to search recipes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Recipe details endpoint
app.post('/api/recipes/details', async (c) => {
  try {
    const { recipeName } = await c.req.json();
    
    const agent = mastra.getAgent('cookingAgent');
    if (!agent) {
      return c.json({ error: '烹饪助手不可用' }, 500);
    }

    const response = await agent.generate([{
      role: 'user',
      content: `获取食谱"${recipeName}"的详细信息。请使用MCP工具获取完整的食谱详情。`
    }]);

    return c.json({
      success: true,
      data: response.object,
      message: 'Recipe details retrieved successfully'
    });
  } catch (error) {
    console.error('Recipe details error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to get recipe details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Weekly menu endpoint
app.post('/api/menu/weekly', async (c) => {
  try {
    const { people = 2, allergies = [] } = await c.req.json();
    
    const agent = mastra.getAgent('cookingAgent');
    if (!agent) {
      return c.json({ error: '烹饪助手不可用' }, 500);
    }

    const response = await agent.generate([{
      role: 'user',
      content: `为${people}人生成每周菜单，过敏情况：${allergies.join(', ')}。请使用MCP工具生成每周餐饮计划。`
    }]);

    return c.json({
      success: true,
      data: response.object,
      message: 'Weekly menu generated successfully'
    });
  } catch (error) {
    console.error('Weekly menu error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to generate weekly menu',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Random meal endpoint
app.post('/api/meal/random', async (c) => {
  try {
    const { mealType = 'any' } = await c.req.json();
    
    const agent = mastra.getAgent('cookingAgent');
    if (!agent) {
      return c.json({ error: '烹饪助手不可用' }, 500);
    }

    const response = await agent.generate([{
      role: 'user',
      content: `推荐一个随机的${mealType === 'any' ? '任意' : mealType}餐点。请使用MCP工具获取随机餐点建议。`
    }]);

    return c.json({
      success: true,
      data: response.object,
      message: 'Random meal suggestion generated successfully'
    });
  } catch (error) {
    console.error('Random meal error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to get random meal suggestion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Chat endpoint for general cooking questions
app.post('/api/chat', async (c) => {
  try {
    const { message, conversationId } = await c.req.json();
    
    const agent = mastra.getAgent('cookingAgent');
    if (!agent) {
      return c.json({ error: '烹饪助手不可用' }, 500);
    }

    const response = await agent.generate([{
      role: 'user',
      content: message
    }]);

    return c.json({
      success: true,
      response: response.text,
      conversationId: conversationId || 'new',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to process chat message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Workflow endpoint
app.post('/api/workflow/cooking', async (c) => {
  try {
    const { query } = await c.req.json();
    
    const workflow = mastra.getWorkflow('cookingWorkflow');
    if (!workflow) {
      return c.json({ error: '烹饪工作流不可用' }, 500);
    }

    const result = await workflow.execute({
      query
    });

    return c.json({
      success: true,
      result,
      message: 'Workflow executed successfully'
    });
  } catch (error) {
    console.error('Workflow error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to execute workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;