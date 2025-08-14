export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  workflowStep?: WorkflowStep;
}

export interface WorkflowStep {
  currentStep: string;
  totalSteps: number;
  stepIndex: number;
  stepName: string;
  stepDescription: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface WorkflowResponse {
  response: string;
  metadata: {
    dishes: string[];
    queryType: 'single' | 'combination';
    detailedDish?: string;
    hasAnyRecipe: boolean;
    hasNutritionInfo: boolean;
    architecture: string;
  };
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  query: string;
  icon: string;
  category: 'single' | 'combination' | 'ingredient';
  color: string;
}