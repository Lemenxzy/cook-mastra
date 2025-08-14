import { useState, useEffect, useRef } from 'react';
import { Message } from './types';
import { CookingAPI } from './lib/api';
import { generateId } from './lib/utils';
import { MessageBubble } from './components/MessageBubble';
import { LoadingIndicator } from './components/LoadingIndicator';
import { ChatInput } from './components/ChatInput';
import { Sidebar } from './components/Sidebar';
import { WorkflowStepIndicator } from './components/WorkflowStepIndicator';
import { ChefHat, Sparkles, Clock, Users } from 'lucide-react';

const api = new CookingAPI();

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始欢迎消息
  useEffect(() => {
    const welcomeMessage: Message = {
      id: generateId(),
      type: 'assistant',
      content: `🍳 欢迎使用智能烹饪助手！

我可以帮您：
• 🥘 查找菜谱制作方法
• 🥬 根据食材推荐菜品  
• 🍽️ 搭配营养均衡餐食
• 📊 提供营养成分分析

请选择左侧快捷菜单，或者直接输入您的烹饪问题！`,
      timestamp: Date.now()
    };
    setMessages([welcomeMessage]);
  }, []);

  const handleSendMessage = async (query: string) => {
    // 添加用户消息
    const userMessage: Message = {
      id: generateId(),
      type: 'user',
      content: query,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 创建流式响应消息
      const assistantMessageId = generateId();
      setIsStreaming(true);
      
      const assistantMessage: Message = {
        id: assistantMessageId,
        type: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);

      // 使用流式API
      let fullContent = '';
      try {
        for await (const chunk of api.executeWorkflowStream(query)) {
          // 处理工作流步骤状态
          if (chunk.workflowStep) {
            setCurrentWorkflowStep(chunk.workflowStep);
          }
          
          // 处理内容流
          if (chunk.content) {
            if (chunk.isComplete) {
              // 完整响应，替换所有内容
              fullContent = chunk.content;
            } else {
              // 增量内容
              fullContent += chunk.content;
            }
            
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessageId 
                ? { ...msg, content: fullContent, workflowStep: currentWorkflowStep }
                : msg
            ));
          }
          
          // 处理完成状态
          if (chunk.isComplete) {
            setCurrentWorkflowStep(null);
            break;
          }
        }
      } catch (streamError) {
        // 如果流式失败，尝试普通API
        console.warn('流式API失败，尝试普通API:', streamError);
        setCurrentWorkflowStep(null);
        const response = await api.executeWorkflow(query);
        fullContent = response.response;
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: fullContent }
            : msg
        ));
      }

      // 完成流式传输
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false }
          : msg
      ));

    } catch (error) {
      console.error('API调用失败:', error);
      
      const errorMessage: Message = {
        id: generateId(),
        type: 'assistant',
        content: `抱歉，处理您的请求时出现了问题。请稍后重试。

错误信息：${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setCurrentWorkflowStep(null);
    }
  };

  const handleQuickAction = (query: string) => {
    handleSendMessage(query);
  };


  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <Sidebar onActionClick={handleQuickAction} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Header - Fixed */}
        <header className="bg-card border-b border-border flex-shrink-0">
          <div className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground">
                <ChefHat size={24} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">智能烹饪助手</h1>
                <p className="text-sm text-muted-foreground">AI驱动的美食制作专家</p>
              </div>
              <div className="ml-auto flex items-center gap-4 text-muted-foreground">
                <div className="hidden sm:flex items-center gap-1 text-xs">
                  <Clock size={14} />
                  <span>实时响应</span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-xs">
                  <Users size={14} />
                  <span>个性化推荐</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Sparkles size={14} />
                  <span>AI助手</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Messages Area - Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-6 py-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* 工作流步骤指示器 */}
            {currentWorkflowStep && (
              <WorkflowStepIndicator workflowStep={currentWorkflowStep} />
            )}
            
            {isLoading && !isStreaming && <LoadingIndicator />}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat Input - Fixed */}
        <div className="border-t border-border flex-shrink-0">
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading || isStreaming}
            placeholder={isStreaming ? "正在处理中..." : "问我任何烹饪问题..."}
          />
        </div>
      </div>
    </div>
  );
}

export default App;