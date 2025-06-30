
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Package, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BatchStatusIndicatorProps {
  jobId: string;
  batchCategory?: string;
  batchJobId?: string;
  batchId?: string;
  status: string;
  onViewBatchJob?: () => void;
}

export const BatchStatusIndicator: React.FC<BatchStatusIndicatorProps> = ({
  jobId,
  batchCategory,
  batchJobId,
  batchId,
  status,
  onViewBatchJob
}) => {
  if (status !== 'In Batch Processing' && !batchCategory) {
    return null;
  }

  const getBatchStatusColor = () => {
    switch (status) {
      case 'In Batch Processing':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Batch Complete':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
      <Package className="h-4 w-4 text-orange-600" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge className={getBatchStatusColor()}>
            {status === 'In Batch Processing' ? 'In Batch' : 'Batch Complete'}
          </Badge>
          {batchCategory && (
            <span className="text-sm text-gray-600">
              Category: {batchCategory}
            </span>
          )}
        </div>
        {batchJobId && (
          <div className="text-xs text-gray-500 mt-1">
            Batch Job: {batchJobId.substring(0, 8)}...
          </div>
        )}
      </div>
      
      {onViewBatchJob && (
        <Button
          size="sm"
          variant="outline"
          onClick={onViewBatchJob}
          className="text-xs"
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          View in BatchFlow
        </Button>
      )}
      
      {status === 'In Batch Processing' && (
        <div className="flex items-center text-xs text-orange-600">
          <Clock className="h-3 w-3 mr-1" />
          Processing
        </div>
      )}
    </div>
  );
};
