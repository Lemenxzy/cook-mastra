import React from 'react';
import { QuickAction } from '../types';

interface QuickActionCardProps {
  action: QuickAction;
  onClick: (query: string) => void;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({ action, onClick }) => {
  return (
    <div
      onClick={() => onClick(action.query)}
      className="group cursor-pointer bg-card border border-border rounded-lg p-3 hover:shadow-md transition-all duration-200 hover:scale-[1.02] hover:border-primary/50"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${action.color} flex items-center justify-center text-sm group-hover:scale-110 transition-transform duration-200`}>
          {action.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-card-foreground group-hover:text-primary transition-colors duration-200">
            {action.title}
          </h3>
          <p className="text-xs text-muted-foreground truncate leading-tight">
            {action.description}
          </p>
        </div>
      </div>
    </div>
  );
};