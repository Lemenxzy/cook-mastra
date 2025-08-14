import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSend, 
  disabled = false,
  placeholder = "问我任何烹饪问题..."
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  // 自动调整文本区域高度
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [message]);

  return (
    <div className="bg-card border-t border-border p-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 pr-12 bg-secondary border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none transition-colors duration-200 disabled:opacity-50"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Sparkles size={16} />
          </div>
        </div>
        
        <button
          type="submit"
          disabled={disabled || !message.trim()}
          className="flex-shrink-0 w-12 h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl flex items-center justify-center transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} />
        </button>
      </form>
      
      <div className="flex items-center justify-center mt-2">
        <p className="text-xs text-muted-foreground">
          按 Enter 发送，Shift+Enter 换行
        </p>
      </div>
    </div>
  );
};