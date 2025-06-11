
import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefreshIndicatorProps {
  lastUpdated: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  getTimeSinceLastUpdate: () => string | null;
  className?: string;
  showTimeOnly?: boolean;
}

export const RefreshIndicator: React.FC<RefreshIndicatorProps> = ({
  lastUpdated,
  isRefreshing,
  onRefresh,
  getTimeSinceLastUpdate,
  className,
  showTimeOnly = false
}) => {
  const timeSince = getTimeSinceLastUpdate();

  if (showTimeOnly) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-gray-500", className)}>
        <Clock className="h-3 w-3" />
        <span>
          {timeSince ? `Updated ${timeSince}` : 'Never updated'}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Clock className="h-3 w-3" />
        <span>
          {timeSince ? `Updated ${timeSince}` : 'Never updated'}
        </span>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2"
      >
        <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  );
};
