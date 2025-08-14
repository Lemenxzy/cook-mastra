import React from 'react';
import { ChefHat } from 'lucide-react';

export const LoadingIndicator: React.FC = () => {
  return (
    <div className="flex items-start gap-3 mb-4 animate-slide-up">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white">
        <ChefHat size={16} />
      </div>
      
      {/* Loading Message */}
      <div className="max-w-[80%]">
        <div className="inline-block px-4 py-2 bg-secondary text-secondary-foreground rounded-2xl rounded-tl-md">
          <div className="flex items-center gap-2">
            <span className="text-sm">正在思考美食</span>
            <div className="loading-dots">
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};