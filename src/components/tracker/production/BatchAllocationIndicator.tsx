
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Package, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BatchAllocationIndicatorProps {
  jobId: string;
  batchCategory?: string;
  onAdvanceToPrinting?: (jobId: string) => void;
  isProcessing?: boolean;
}

export const BatchAllocationIndicator: React.FC<BatchAllocationIndicatorProps> = ({
  jobId,
  batchCategory,
  onAdvanceToPrinting,
  isProcessing = false
}) => {
  return (
    <div className="flex items-center gap-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
      <Package className="h-4 w-4 text-orange-600" />
      <div className="flex-1">
        <div className="text-sm font-medium text-orange-900">
          Batch Allocation
        </div>
        {batchCategory && (
          <div className="text-xs text-orange-700">
            Category: {batchCategory}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-orange-700 border-orange-300">
          <Clock className="h-3 w-3 mr-1" />
          Waiting
        </Badge>
        {onAdvanceToPrinting && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAdvanceToPrinting(jobId)}
            disabled={isProcessing}
            className="text-xs"
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            {isProcessing ? 'Processing...' : 'Skip to Print'}
          </Button>
        )}
      </div>
    </div>
  );
};
