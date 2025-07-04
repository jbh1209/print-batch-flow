import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  Split, 
  Users, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Loader2 
} from "lucide-react";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs/types";
import { useBatchSplitting } from "@/hooks/tracker/useBatchSplitting";
import { useBatchConstituentJobs } from "@/hooks/tracker/useBatchConstituentJobs";

interface BatchSplitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  batchJob: AccessibleJob;
  onSplitComplete?: () => void;
}

export const BatchSplitDialog: React.FC<BatchSplitDialogProps> = ({
  isOpen,
  onClose,
  batchJob,
  onSplitComplete
}) => {
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitResult, setSplitResult] = useState<any>(null);
  
  const { splitBatch, getSplitAuditTrail } = useBatchSplitting();
  
  // Extract batch name from WO number
  const batchName = batchJob.wo_no?.replace('BATCH-', '') || '';
  
  const { constituentJobs, isLoading: jobsLoading } = useBatchConstituentJobs(batchName);

  const handleSplit = async () => {
    setIsSplitting(true);
    try {
      console.log('🔄 Initiating batch split for:', batchJob.job_id);
      
      const result = await splitBatch({
        batchJobId: batchJob.job_id,
        splitReason: `Completed at ${batchJob.current_stage_name} stage - returning to individual workflow`,
        targetStageId: undefined // Let the service determine the next stage
      });
      
      setSplitResult(result);
      
      if (result.success) {
        console.log('✅ Batch split successful:', result);
        // Wait a moment for user to see success, then close
        setTimeout(() => {
          onSplitComplete?.();
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Error during batch split:', error);
      setSplitResult({
        success: false,
        splitJobsCount: 0,
        message: `Split failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsSplitting(false);
    }
  };

  const handleCancel = () => {
    if (!isSplitting) {
      onClose();
    }
  };

  // If split is complete and successful, show success state
  if (splitResult?.success) {
    return (
      <Dialog open={isOpen} onOpenChange={handleCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Batch Split Complete
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Successfully split batch <strong>{batchName}</strong> into{' '}
                <strong>{splitResult.splitJobsCount}</strong> individual jobs.
                <div className="mt-2 text-sm text-green-700">
                  Jobs have been returned to their individual workflows and can continue processing.
                </div>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button onClick={handleCancel} className="bg-green-600 hover:bg-green-700">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // If split failed, show error state
  if (splitResult && !splitResult.success) {
    return (
      <Dialog open={isOpen} onOpenChange={handleCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Batch Split Failed
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert className="border-red-500 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <strong>Error:</strong> {splitResult.message}
                <div className="mt-2 text-sm text-red-700">
                  Please try again or contact support if the issue persists.
                </div>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitResult(null)}>
              Try Again
            </Button>
            <Button onClick={handleCancel}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Main split confirmation dialog
  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Split className="h-5 w-5" />
            Split Batch to Individual Jobs
          </DialogTitle>
          <DialogDescription>
            This will break apart the batch and return all constituent jobs to their individual workflows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Batch Information */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-gray-600" />
              <span className="font-medium">Batch: {batchName}</span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Work Order: {batchJob.wo_no}</div>
              <div>Current Stage: {batchJob.current_stage_name}</div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Stage: {batchJob.current_stage_status}
              </div>
            </div>
          </div>

          {/* Constituent Jobs Information */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-gray-600" />
              <span className="font-medium">Constituent Jobs</span>
            </div>
            
            {jobsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading constituent jobs...
              </div>
            ) : constituentJobs.length > 0 ? (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {constituentJobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div>
                      <div className="font-medium text-sm">{job.wo_no}</div>
                      <div className="text-xs text-gray-500">{job.customer}</div>
                    </div>
                    <Badge variant="outline" style={{ borderColor: job.category_color }}>
                      {job.category_name}
                    </Badge>
                  </div>
                ))}
                {constituentJobs.length > 5 && (
                  <div className="text-sm text-gray-500 text-center">
                    ... and {constituentJobs.length - 5} more jobs
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">No constituent jobs found</div>
            )}
          </div>

          <Separator />

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Once split, individual jobs will continue through their own workflows. 
              This action cannot be undone.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isSplitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSplit}
            disabled={isSplitting || constituentJobs.length === 0}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSplitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Splitting...
              </>
            ) : (
              <>
                <Split className="h-4 w-4 mr-2" />
                Split Batch ({constituentJobs.length} jobs)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};