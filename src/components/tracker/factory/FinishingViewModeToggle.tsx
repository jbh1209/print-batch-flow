import React from 'react';
import { Button } from '@/components/ui/button';
import { List, Columns3 } from 'lucide-react';

export type FinishingViewMode = 'single-stage' | 'multi-stage';

interface FinishingViewModeToggleProps {
  viewMode: FinishingViewMode;
  onViewModeChange: (mode: FinishingViewMode) => void;
  disabled?: boolean;
}

export const FinishingViewModeToggle: React.FC<FinishingViewModeToggleProps> = ({
  viewMode,
  onViewModeChange,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant={viewMode === 'single-stage' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewModeChange('single-stage')}
        disabled={disabled}
        className="flex items-center gap-2"
      >
        <List className="h-4 w-4" />
        Single Stage
      </Button>
      <Button
        variant={viewMode === 'multi-stage' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onViewModeChange('multi-stage')}
        disabled={disabled}
        className="flex items-center gap-2"
      >
        <Columns3 className="h-4 w-4" />
        Multi-Stage Kanban
      </Button>
    </div>
  );
};
