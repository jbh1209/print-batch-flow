import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

interface BatchStageIndicatorProps {
  job: AccessibleJob;
  showLabel?: boolean;
  compact?: boolean;
}

export const BatchStageIndicator: React.FC<BatchStageIndicatorProps> = ({
  job,
  showLabel = true,
  compact = false
}) => {
  const isBatchAllocationStage = job.current_stage_name === 'Batch Allocation';
  const isInBatchProcessing = job.is_in_batch_processing || job.status === 'In Batch Processing';

  // Don't show indicator if not relevant to batching
  if (!isBatchAllocationStage && !isInBatchProcessing) {
    return null;
  }

  const getBatchStatusInfo = () => {
    if (isInBatchProcessing) {
      return {
        icon: <Package className="h-3 w-3" />,
        label: 'In Batch',
        variant: 'default' as const,
        className: 'bg-blue-600 text-white',
        tooltip: 'Job is currently being processed in a batch'
      };
    }

    if (isBatchAllocationStage && job.current_stage_status === 'active') {
      return {
        icon: <Package className="h-3 w-3" />,
        label: 'Batch Allocation',
        variant: 'default' as const,
        className: 'bg-orange-600 text-white',
        tooltip: 'Job is in batch allocation stage'
      };
    }

    if (isBatchAllocationStage && job.current_stage_status === 'pending') {
      return {
        icon: <Clock className="h-3 w-3" />,
        label: 'Batch Pending',
        variant: 'secondary' as const,
        className: 'bg-gray-200 text-gray-700',
        tooltip: 'Waiting for batch allocation'
      };
    }

    return null;
  };

  const statusInfo = getBatchStatusInfo();
  
  if (!statusInfo) {
    return null;
  }

  const badgeContent = (
    <Badge 
      variant={statusInfo.variant}
      className={`${statusInfo.className} ${compact ? 'text-xs px-2 py-1' : ''} flex items-center gap-1`}
    >
      {statusInfo.icon}
      {showLabel && <span>{statusInfo.label}</span>}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <p>{statusInfo.tooltip}</p>
          {job.batch_category && (
            <p className="text-xs opacity-75">Category: {job.batch_category}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};