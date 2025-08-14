import { WorkflowStep } from '../types';

interface WorkflowStepIndicatorProps {
  workflowStep: WorkflowStep;
}

export function WorkflowStepIndicator({ workflowStep }: WorkflowStepIndicatorProps) {
  const getStepColor = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'running':
        return 'text-blue-600 bg-blue-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressWidth = () => {
    // 确保进度对应到正确的步骤圆圈位置
    const totalSteps = workflowStep.totalSteps;
    const currentStep = workflowStep.stepIndex;
    
    if (currentStep === 0) return '0%';
    if (currentStep >= totalSteps) return '100%';
    
    // 计算进度百分比，让进度条端点对应到当前步骤的圆圈中心
    const progressPercent = ((currentStep - 1) / (totalSteps - 1)) * 100;
    return `${progressPercent}%`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-foreground">
          处理步骤 {workflowStep.stepIndex} / {workflowStep.totalSteps}
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStepColor(workflowStep.status)}`}>
          {workflowStep.status === 'running' && '进行中'}
          {workflowStep.status === 'completed' && '已完成'}
          {workflowStep.status === 'error' && '错误'}
          {workflowStep.status === 'pending' && '等待中'}
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground mb-3">
        {workflowStep.stepDescription}
      </div>
      
      {/* 步骤指示器容器 */}
      <div className="relative">
        {/* 背景连接线 */}
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-gray-200"></div>
        
        {/* 进度连接线 */}
        <div 
          className="absolute top-3 left-3 h-0.5 bg-primary transition-all duration-300 ease-out"
          style={{ 
            width: `calc((100% - 24px) * ${getProgressWidth().replace('%', '')} / 100)`
          }}
        ></div>
        
        {/* 步骤圆圈 */}
        <div className="flex justify-between items-center relative">
          {Array.from({ length: workflowStep.totalSteps }, (_, index) => {
            const stepNumber = index + 1;
            const isActive = stepNumber <= workflowStep.stepIndex;
            const isCurrent = stepNumber === workflowStep.stepIndex;
            
            return (
              <div
                key={index}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  isActive
                    ? isCurrent && workflowStep.status === 'running'
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-primary text-primary-foreground'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {stepNumber}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}