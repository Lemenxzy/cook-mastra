import React from 'react';
import { Message } from '../types';
import { formatTime } from '../lib/utils';
import { User, ChefHat } from 'lucide-react';
import { MarkdownContent } from './MarkdownContent';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.type === 'user';
  
  return (
    <div className={`flex items-start gap-3 mb-4 animate-slide-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${
        isUser ? 'bg-primary' : 'bg-orange-500'
      }`}>
        {isUser ? <User size={16} /> : <ChefHat size={16} />}
      </div>
      
      {/* Message Content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
        <div className={`inline-block px-4 py-2 rounded-2xl ${
          isUser 
            ? 'bg-primary text-primary-foreground rounded-tr-md' 
            : 'bg-secondary text-secondary-foreground rounded-tl-md'
        }`}>
          <div className={`${message.isStreaming ? 'message-stream' : ''}`}>
            {isUser ? (
              <div className="whitespace-pre-wrap">
                {message.content}
              </div>
            ) : (
              <MarkdownContent 
                content={message.content}
                className="text-inherit"
              />
            )}
            {message.isStreaming && (
              <span className="inline-block w-2 h-5 bg-current ml-1 animate-pulse" />
            )}
          </div>
        </div>
        
        {/* Timestamp */}
        <div className={`text-xs text-muted-foreground mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
};