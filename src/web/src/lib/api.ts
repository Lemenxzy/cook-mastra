import { WorkflowResponse, WorkflowStep } from '../types';
import { getApiBaseUrl } from './utils';

export class CookingAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${getApiBaseUrl()}`;
  }

  async executeWorkflow(query: string): Promise<WorkflowResponse> {
    // 先创建 workflow run
    const createRunResponse = await fetch(`${this.baseUrl}/workflows/cookingNutritionWorkflow/create-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputData: { query } }),
    });

    if (!createRunResponse.ok) {
      throw new Error(`Failed to create workflow run: ${createRunResponse.status}`);
    }

    const runData = await createRunResponse.json();
    const runId = runData.runId || runData.id;

    if (!runId) {
      throw new Error('No runId returned from create-run');
    }

    // 启动 workflow
    const startResponse = await fetch(`${this.baseUrl}/workflows/cookingNutritionWorkflow/start?runId=${runId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!startResponse.ok) {
      throw new Error(`HTTP error! status: ${startResponse.status}`);
    }

    return startResponse.json();
  }

  async *executeWorkflowStream(query: string): AsyncGenerator<{
    content?: string;
    workflowStep?: WorkflowStep;
    isComplete?: boolean;
    finalResponse?: WorkflowResponse;
  }, void, unknown> {
    // 先创建 workflow run
    const createRunResponse = await fetch(`${this.baseUrl}/workflows/cookingNutritionWorkflow/create-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputData: { query } }),
    });

    if (!createRunResponse.ok) {
      throw new Error(`Failed to create workflow run: ${createRunResponse.status}`);
    }

    const runData = await createRunResponse.json();
    const runId = runData.runId || runData.id;

    if (!runId) {
      throw new Error('No runId returned from create-run');
    }

    // 使用 streamVNext 接口和 runId
    const response = await fetch(`${this.baseUrl}/workflows/cookingNutritionWorkflow/streamVNext?runId=${runId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ inputData: { query } }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const steps = [
      { name: 'analyze-and-prepare-content', description: '🔍 智能分析查询，识别菜品类型' },
      { name: 'fetch-nutrition', description: '📊 获取营养信息和健康分析' },
      { name: 'integrate-with-agent', description: '🍳 整合信息，生成完整回复' },
      { name: 'finish', description: '✅ 工作流程完成' }
    ];


    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // 尝试解析缓冲区中的JSON对象
        while (buffer.length > 0) {
          const openBraceIndex = buffer.indexOf('{');
          if (openBraceIndex === -1) break;
          
          // 从第一个大括号开始查找完整的JSON对象
          let braceCount = 0;
          let endIndex = -1;
          
          for (let i = openBraceIndex; i < buffer.length; i++) {
            if (buffer[i] === '{') braceCount++;
            else if (buffer[i] === '}') braceCount--;
            
            if (braceCount === 0) {
              endIndex = i;
              break;
            }
          }
          
          if (endIndex === -1) {
            // 没有找到完整的JSON对象，等待更多数据
            break;
          }
          
          // 提取JSON字符串
          const jsonStr = buffer.substring(openBraceIndex, endIndex + 1);
          buffer = buffer.substring(endIndex + 1);
          
          try {
            const parsed = JSON.parse(jsonStr);
            
            // 处理工作流开始
            if (parsed.type === 'start') {
              // 工作流开始，可以显示初始状态
            }
            
            // 处理步骤开始
            else if (parsed.type === 'step-start' && parsed.payload) {
              const stepName = parsed.payload.stepName;
              const stepIndex = steps.findIndex(s => s.name === stepName);
              
              if (stepIndex !== -1) {
                yield {
                  workflowStep: {
                    currentStep: stepName,
                    totalSteps: steps.length,
                    stepIndex: stepIndex + 1,
                    stepName: steps[stepIndex].name,
                    stepDescription: steps[stepIndex].description,
                    status: 'running'
                  }
                };
              }
            }
            
            // 处理步骤结果
            else if (parsed.type === 'step-result' && parsed.payload) {
              const stepName = parsed.payload.stepName;
              const stepIndex = steps.findIndex(s => s.name === stepName);
              
              if (stepIndex !== -1) {
                yield {
                  workflowStep: {
                    currentStep: stepName,
                    totalSteps: steps.length,
                    stepIndex: stepIndex + 1,
                    stepName: steps[stepIndex].name,
                    stepDescription: steps[stepIndex].description,
                    status: parsed.payload.status === 'success' ? 'completed' : 'error'
                  }
                };
              }
              
              // 如果是最后一步，包含最终结果
              if (stepName === 'integrate-with-agent' && parsed.payload.result) {
                const result = parsed.payload.result;
                if (result.response) {
                  yield {
                    content: result.response,
                    finalResponse: result
                  };
                }
              }
            }
            
            // 处理工作流完成
            else if (parsed.type === 'finish') {
              // 显示完成步骤
              yield {
                workflowStep: {
                  currentStep: 'finish',
                  totalSteps: steps.length,
                  stepIndex: steps.length,
                  stepName: 'finish',
                  stepDescription: '✅ 工作流程完成',
                  status: 'completed'
                }
              };
              
              yield {
                isComplete: true
              };
              return;
            }
            
          } catch (e) {
            // JSON解析失败，跳过这个片段
            console.warn('Failed to parse JSON:', jsonStr, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getHealth(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
}