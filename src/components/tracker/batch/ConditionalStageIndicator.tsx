import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, Clock, CheckCircle, ArrowRight, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

interface ConditionalStageIndicatorProps {
  job: AccessibleJob;
  showLabel?: boolean;
  compact?: boolean;
}

export const ConditionalStageIndicator: React.FC<ConditionalStageIndicatorProps> = ({
  job,
  showLabel = true,
  compact = false
}) => {
  const isConditionalStage = job.is_conditional_stage;
  const shouldShowStage = job.stage_should_show;
  const currentStageStatus = job.current_stage_status;

  // Only show for conditional stages
  if (!isConditionalStage) {
    return null;
  }

  const getStageVisibilityInfo = () => {
    if (shouldShowStage) {
      if (currentStageStatus === 'active') {
        return {
          icon: <Eye className="h-3 w-3" />,
          label: 'Stage Active',
          variant: 'default' as const,
          className: 'bg-blue-600 text-white',
          tooltip: 'Conditional stage is currently active and visible'
        };
      } else {
        return {
          icon: <Clock className="h-3 w-3" />,
          label: 'Stage Pending',
          variant: 'secondary' as const,
          className: 'bg-gray-200 text-gray-700',
          tooltip: 'Conditional stage is pending activation'
        };
      }
    } else {
      return {
        icon: <EyeOff className="h-3 w-3" />,
        label: 'Stage Hidden',
        variant: 'outline' as const,
        className: 'border-gray-300 text-gray-500',
        tooltip: 'Conditional stage is hidden and will be skipped'
      };
    }
  };

  const stageInfo = getStageVisibilityInfo();

  const badgeContent = (
    <Badge 
      variant={stageInfo.variant}
      className={`${stageInfo.className} ${compact ? 'text-xs px-2 py-1' : ''} flex items-center gap-1`}
    >
      {stageInfo.icon}
      {showLabel && <span>{stageInfo.label}</span>}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{stageInfo.tooltip}</p>
          <p className="text-xs opacity-75">Stage: {job.current_stage_name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};