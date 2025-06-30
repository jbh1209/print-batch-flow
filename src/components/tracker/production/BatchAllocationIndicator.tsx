
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnifiedBatchWorkflow } from "@/hooks/batch/useUnifiedBatchWorkflow";

interface BatchAllocationIndicatorProps {
  jobId: string;
  woNo?: string;
  batchCategory?: string;
  status?: string;
  onAdvanceToPrinting?: (jobId: string) => void;
  isProcessing?: boolean;
}

export const BatchAllocationIndicator: React.FC<BatchAllocationIndicatorProps> = ({
  jobId,
  woNo,
  batchCategory,
  status,
  onAdvanceToPrinting,
  isProcessing = false
}) => {
  const { completeBatchProcessing } = useUnifiedBatchWorkflow();

  const handleAdvanceToNextStage = async () => {
    if (onAdvanceToPrinting) {
      onAdvanceToPrinting(jobId);
    } else {
      // Use the unified workflow to complete batch processing
      await completeBatchProcessing(jobId);
    }
  };

  const getBatchStatusInfo = () => {
    switch (status) {
      case 'Batch Allocation':
        return {
          icon: Clock,
          text: 'Waiting for Batch',
          color: 'text-orange-700 border-orange-300 bg-orange-50',
          actionText: 'Move to Processing'
        };
      case 'In Batch Processing':
        return {
          icon: Package,
          text: 'In Batch',
          color: 'text-blue-700 border-blue-300 bg-blue-50',
          actionText: 'Complete Batch'
        };
      default:
        return {
          icon: Clock,
          text: 'Batch Allocation',
          color: 'text-orange-700 border-orange-300 bg-orange-50',
          actionText: 'Skip to Print'
        };
    }
  };

  const statusInfo = getBatchStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={`flex items-center gap-2 p-2 border rounded-md ${statusInfo.color}`}>
      <StatusIcon className="h-4 w-4" />
      <div className="flex-1">
        <div className="text-sm font-medium">
          {statusInfo.text}
        </div>
        {batchCategory && (
          <div className="text-xs opacity-75">
            Category: {batchCategory}
          </div>
        )}
        {woNo && (
          <div className="text-xs opacity-75">
            Job: {woNo}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={statusInfo.color}>
          {status === 'In Batch Processing' ? (
            <>
              <Package className="h-3 w-3 mr-1" />
              Processing
            </>
          ) : (
            <>
              <Clock className="h-3 w-3 mr-1" />
              Waiting
            </>
          )}
        </Badge>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdvanceToNextStage}
          disabled={isProcessing}
          className="text-xs"
        >
          {status === 'In Batch Processing' ? (
            <>
              <CheckCircle className="h-3 w-3 mr-1" />
              {isProcessing ? 'Completing...' : 'Complete'}
            </>
          ) : (
            <>
              <ArrowRight className="h-3 w-3 mr-1" />
              {isProcessing ? 'Processing...' : statusInfo.actionText}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
