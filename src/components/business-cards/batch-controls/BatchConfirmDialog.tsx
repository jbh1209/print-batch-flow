
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader, AlertCircle } from "lucide-react";
import { Job } from "../JobsTable";
import { BatchOptimization } from "@/utils/batchOptimizationHelpers";
import { format, formatDistanceToNow } from "date-fns";

interface BatchConfirmDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedJobs: Job[];
  batchName: string;
  setBatchName: (name: string) => void;
  onConfirm: () => Promise<void>;
  isCreatingBatch: boolean;
  optimization: BatchOptimization | null;
  upcomingDueJobs: Job[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
}

const BatchConfirmDialog = ({
  isOpen,
  setIsOpen,
  selectedJobs,
  batchName,
  setBatchName,
  onConfirm,
  isCreatingBatch,
  optimization,
  upcomingDueJobs,
  onSelectJob
}: BatchConfirmDialogProps) => {
  // Get job details for display
  const getJobDetails = () => {
    const laminationTypes = new Set(selectedJobs.map(job => job.lamination_type));
    const totalCards = selectedJobs.reduce((sum, job) => sum + job.quantity, 0);
    const sheetsRequired = optimization?.sheetsRequired || Math.ceil(totalCards / 24);
    
    return {
      totalJobs: selectedJobs.length,
      totalCards,
      sheetsRequired,
      laminationTypes: Array.from(laminationTypes)
    };
  };
  
  // Determine if selected jobs are compatible for batching
  const areJobsCompatible = () => {
    if (selectedJobs.length <= 1) {
      return true; // Single job or no jobs is always compatible
    }
    
    // All jobs should have the same lamination type
    const firstLamination = selectedJobs[0].lamination_type;
    return selectedJobs.every(job => job.lamination_type === firstLamination);
  };
  
  const jobDetails = getJobDetails();
  const isCompatible = areJobsCompatible();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Batch</DialogTitle>
          <DialogDescription>
            You are about to create a batch with {jobDetails.totalJobs} jobs
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="batch-name">Batch Name</Label>
            <Input
              id="batch-name"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="Enter batch name"
            />
          </div>
          
          <div className="space-y-1 rounded-md bg-muted p-3 text-sm">
            <div className="font-medium">Batch Details</div>
            <div className="text-muted-foreground">Total Jobs: {jobDetails.totalJobs}</div>
            <div className="text-muted-foreground">Total Cards: {jobDetails.totalCards}</div>
            <div className="text-muted-foreground">Sheets Required: {jobDetails.sheetsRequired}</div>
            <div className="text-muted-foreground">
              Lamination: {jobDetails.laminationTypes.map(t => 
                t === 'none' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)
              ).join(', ')}
            </div>
            
            {optimization && (
              <div className="mt-2 border-t pt-2 border-border/30">
                <div className="font-medium">Job Distribution</div>
                <div className="max-h-32 overflow-auto">
                  {optimization.distribution.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5">
                      <span className="truncate max-w-[150px]" title={item.job.name}>{item.job.name}</span>
                      <span className="text-muted-foreground">
                        {item.slotsNeeded} {item.slotsNeeded === 1 ? 'slot' : 'slots'}
                        {item.job.quantity > 0 && ` (${item.quantityPerSlot}/slot)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {!isCompatible && (
              <div className="mt-2 flex items-center text-red-500 gap-1">
                <AlertCircle className="h-4 w-4" />
                <span>Warning: Jobs have different lamination types</span>
              </div>
            )}
          </div>

          {upcomingDueJobs.length > 0 && (
            <div className="space-y-1 rounded-md bg-amber-50 p-3 text-sm border border-amber-200">
              <div className="font-medium text-amber-800 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Jobs With Upcoming Due Dates
              </div>
              <p className="text-amber-700 text-xs mb-2">Consider adding these jobs to your batch:</p>
              <div className="max-h-32 overflow-auto">
                {upcomingDueJobs.slice(0, 5).map(job => (
                  <div key={job.id} className="flex justify-between items-center text-xs py-1 border-t border-amber-200/50">
                    <div className="flex flex-col">
                      <span className="font-medium">{job.name}</span>
                      <span className="text-amber-700">
                        Due: {formatDistanceToNow(new Date(job.due_date), { addSuffix: true })}
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-7 text-xs"
                      onClick={() => onSelectJob(job.id, true)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
                {upcomingDueJobs.length > 5 && (
                  <div className="text-center text-xs text-amber-700 mt-1">
                    +{upcomingDueJobs.length - 5} more jobs
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            disabled={isCreatingBatch}
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={!batchName.trim() || isCreatingBatch}
            className="gap-2"
          >
            {isCreatingBatch ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Batch"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BatchConfirmDialog;
