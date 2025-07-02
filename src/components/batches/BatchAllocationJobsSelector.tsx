import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Package, Calendar, User, Building } from 'lucide-react';
import { useBatchAllocationDetection } from '@/hooks/tracker/useBatchAllocationDetection';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';
import { processBatchJobs } from '@/utils/batch/batchJobProcessor';
import { toast } from 'sonner';

interface BatchAllocationJobsSelectorProps {
  batchId: string;
  batchCategory?: string;
  onJobsAdded: () => void;
}

export const BatchAllocationJobsSelector: React.FC<BatchAllocationJobsSelectorProps> = ({
  batchId,
  batchCategory,
  onJobsAdded
}) => {
  const { jobsInBatchAllocation, jobsByCategory, isLoading, refreshJobs } = useBatchAllocationDetection();
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter jobs based on batch category if specified
  const relevantJobs = batchCategory && jobsByCategory[batchCategory] 
    ? jobsByCategory[batchCategory]
    : jobsInBatchAllocation;

  const handleJobToggle = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedJobs.size === relevantJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(relevantJobs.map(job => job.job_id)));
    }
  };

  const handleAddToBatch = async () => {
    if (selectedJobs.size === 0) {
      toast.error('Please select at least one job');
      return;
    }

    try {
      setIsProcessing(true);
      
      const result = await processBatchJobs({
        jobIds: Array.from(selectedJobs),
        batchId,
        tableName: 'production_jobs'
      });

      if (result.success) {
        toast.success(`Successfully added ${result.linkedCount} jobs to batch`);
        setSelectedJobs(new Set());
        refreshJobs();
        onJobsAdded();
      } else {
        toast.error(`Failed to add ${result.unlinkedCount} jobs to batch`);
      }
    } catch (error) {
      console.error('❌ Error adding jobs to batch:', error);
      toast.error('Failed to add jobs to batch');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading jobs ready for batching...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (relevantJobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Jobs Ready for Batching
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No jobs ready for batching</p>
            <p className="text-sm text-gray-500">
              Jobs in the "Batch Allocation" stage will appear here when ready.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Jobs Ready for Batching
          <Badge variant="secondary">{relevantJobs.length} available</Badge>
        </CardTitle>
        <div className="flex items-center justify-between">
          <Button
            onClick={handleSelectAll}
            variant="outline"
            size="sm"
          >
            {selectedJobs.size === relevantJobs.length ? 'Deselect All' : 'Select All'}
          </Button>
          <Badge variant="outline">
            {selectedJobs.size} selected
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {relevantJobs.map((job) => (
            <div
              key={job.job_id}
              className={`p-3 border rounded-lg transition-colors ${
                selectedJobs.has(job.job_id) 
                  ? 'border-primary bg-primary/5' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedJobs.has(job.job_id)}
                  onCheckedChange={() => handleJobToggle(job.job_id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{job.wo_no}</span>
                    {job.batch_category && (
                      <Badge variant="outline" className="text-xs">
                        {job.batch_category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      <span className="truncate">{job.customer}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      <span>Qty: {job.qty}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(job.due_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedJobs.size > 0 && (
          <div className="border-t pt-4 mt-4">
            <Button
              onClick={handleAddToBatch}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 mr-2" />
                  Add {selectedJobs.size} Job{selectedJobs.size === 1 ? '' : 's'} to Batch
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};