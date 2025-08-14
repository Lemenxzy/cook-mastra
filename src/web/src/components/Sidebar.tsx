import { QuickActionCard } from './QuickActionCard';
import { quickActions, categoryLabels } from '../data/quickActions';
import { ChefHat } from 'lucide-react';

interface SidebarProps {
  onActionClick: (query: string) => void;
}

export function Sidebar({ onActionClick }: SidebarProps) {
  const groupedActions = quickActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, typeof quickActions>);

  return (
    <div className="w-80 h-screen bg-card border-r border-border flex flex-col">
      {/* Sidebar Header - Fixed */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground">
            <ChefHat size={18} />
          </div>
          <h2 className="text-lg font-semibold text-foreground">快捷菜单</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">选择下方选项快速开始烹饪之旅</p>
      </div>

      {/* Quick Actions - Scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-5">
          {Object.entries(groupedActions).map(([category, actions]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-sm font-medium text-foreground px-1 border-l-2 border-primary pl-2">
                {categoryLabels[category as keyof typeof categoryLabels]}
              </h3>
              <div className="space-y-2">
                {actions.map((action) => (
                  <QuickActionCard
                    key={action.id}
                    action={action}
                    onClick={onActionClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}