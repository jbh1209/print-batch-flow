
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Package, Loader2 } from 'lucide-react';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { BatchAllocationStage } from '../../batch-allocation/BatchAllocationStage';

interface BatchAllocationSectionProps {
  job: AccessibleJob;
  onRefresh: () => void;
}

export const BatchAllocationSection: React.FC<BatchAllocationSectionProps> = ({
  job,
  onRefresh
}) => {
  const [showBatchAllocation, setShowBatchAllocation] = useState(false);

  const handleComplete = () => {
    setShowBatchAllocation(false);
    onRefresh();
  };

  const handleCancel = () => {
    setShowBatchAllocation(false);
  };

  // Show batch allocation interface if activated
  if (showBatchAllocation) {
    return (
      <BatchAllocationStage
        job={job}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
  }

  // Show activate button for batch allocation stage
  return (
    <div className="space-y-3">
      <Button
        onClick={() => setShowBatchAllocation(true)}
        className="w-full"
        variant="default"
      >
        <Package className="h-4 w-4 mr-2" />
        Start Batch Allocation
      </Button>
      <p className="text-xs text-gray-500 text-center">
        Allocate this job to a production batch or proceed directly to printing
      </p>
    </div>
  );
};
