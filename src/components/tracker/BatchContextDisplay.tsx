import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, Users, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import type { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { formatDistanceToNow } from 'date-fns';

interface BatchContextDisplayProps {
  job: AccessibleJob;
  showActions?: boolean;
  onViewBatch?: () => void;
  className?: string;
}

export const BatchContextDisplay: React.FC<BatchContextDisplayProps> = ({
  job,
  showActions = true,
  onViewBatch,
  className = ''
}) => {
  if (!job.is_batch_master && !job.is_in_batch_processing && job.status !== 'In Batch Processing') {
    return null;
  }

  const getBatchInfo = () => {
    if (job.is_batch_master) {
      return {
        type: 'Batch Master Job',
        description: `This is a master job representing a batch of ${job.constituent_job_count || 0} individual jobs`,
        name: job.batch_name || job.wo_no.replace('BATCH-', ''),
        color: 'bg-purple-50 border-purple-200',
        badgeColor: 'bg-purple-100 text-purple-800',
        icon: Package,
        iconColor: 'text-purple-600',
        status: 'Managing batch workflow through production stages',
        count: job.constituent_job_count
      };
    } else {
      return {
        type: 'Individual Job in Batch Processing',
        description: 'This job is currently being processed as part of a batch and is hidden from individual workflow stages',
        name: job.batch_name || 'Unknown Batch',
        color: 'bg-orange-50 border-orange-200',
        badgeColor: 'bg-orange-100 text-orange-800',
        icon: Users,
        iconColor: 'text-orange-600',
        status: 'Will return to individual workflow at packaging stage'
      };
    }
  };

  const batchInfo = getBatchInfo();

  return (
    <Card className={`${batchInfo.color} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <batchInfo.icon className={`h-4 w-4 ${batchInfo.iconColor}`} />
          Batch Processing Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Batch Type & Name */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="font-medium text-sm">{batchInfo.type}</div>
            <Badge variant="secondary" className={`${batchInfo.badgeColor} text-xs`}>
              {batchInfo.name}
              {batchInfo.count && ` (${batchInfo.count} jobs)`}
            </Badge>
          </div>
        </div>

        {/* Description */}
        <div className="text-sm text-muted-foreground">
          {batchInfo.description}
        </div>

        {/* Current Status */}
        <div className="flex items-center gap-2 p-2 bg-background/50 rounded border-l-2 border-current">
          <AlertCircle className="h-3 w-3" />
          <span className="text-xs font-medium">{batchInfo.status}</span>
        </div>

        {/* Workflow Info for Master Jobs */}
        {job.is_batch_master && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Batch Workflow Progress</div>
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: job.current_stage_color }}
              />
              <span className="text-sm">{job.display_stage_name}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Will auto-split at Packaging stage
              </span>
            </div>
          </div>
        )}

        {/* Due Date Info */}
        {job.due_date && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Due {formatDistanceToNow(new Date(job.due_date), { addSuffix: true })}
            </span>
          </div>
        )}

        {/* Actions */}
        {showActions && onViewBatch && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewBatch}
              className="w-full"
            >
              <Package className="h-3 w-3 mr-2" />
              View Batch Details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};