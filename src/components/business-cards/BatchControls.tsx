
import { useState, useEffect } from "react";
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
import { Loader, FileCheck, AlertCircle, LayoutGrid, Info } from "lucide-react";
import { Job } from "./JobsTable";
import { useBatchCreation } from "@/hooks/useBatchCreation";
import { 
  calculateOptimalDistribution,
  shouldRecommendBatch,
  SLOTS_PER_SHEET,
  MIN_RECOMMENDED_JOBS,
  BatchOptimization
} from "@/utils/batchOptimizationHelpers";
import { format, formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface BatchControlsProps {
  selectedJobs: Job[];
  allAvailableJobs: Job[];
  onBatchComplete: () => void;
  onSelectJob: (jobId: string, isSelected: boolean) => void;
}

const BatchControls = ({ 
  selectedJobs, 
  allAvailableJobs,
  onBatchComplete,
  onSelectJob
}: BatchControlsProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [optimization, setOptimization] = useState<BatchOptimization | null>(null);
  const { createBatch, isCreatingBatch } = useBatchCreation();

  // Calculate optimization whenever selected jobs change
  useEffect(() => {
    if (selectedJobs.length > 0) {
      const optimizedBatch = calculateOptimalDistribution(selectedJobs);
      setOptimization(optimizedBatch);
    } else {
      setOptimization(null);
    }
  }, [selectedJobs]);

  const handleBatchClick = () => {
    if (selectedJobs.length === 0) {
      return;
    }
    
    // Generate a default batch name
    const defaultName = `Batch-${new Date().toISOString().split('T')[0]}`;
    setBatchName(defaultName);
    setDialogOpen(true);
  };

  const handleConfirmBatch = async () => {
    const success = await createBatch(selectedJobs, batchName);
    if (success) {
      setDialogOpen(false);
      onBatchComplete();
    }
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
  
  // Get job counts by property
  const getJobDetails = () => {
    const laminationTypes = new Set(selectedJobs.map(job => job.lamination_type));
    const totalCards = selectedJobs.reduce((sum, job) => sum + job.quantity, 0);
    
    // Use our optimization function instead of the simple calculation
    const sheetsRequired = optimization?.sheetsRequired || Math.ceil(totalCards / SLOTS_PER_SHEET);
    
    return {
      totalJobs: selectedJobs.length,
      totalCards,
      sheetsRequired,
      laminationTypes: Array.from(laminationTypes)
    };
  };
  
  // Check if we should recommend creating a batch
  const shouldRecommend = shouldRecommendBatch(allAvailableJobs.filter(j => j.status === 'queued'));
  
  // Find jobs with upcoming due dates
  const getUpcomingDueJobs = () => {
    const now = new Date();
    return allAvailableJobs
      .filter(job => job.status === 'queued' && !selectedJobs.find(j => j.id === job.id))
      .filter(job => {
        const dueDate = new Date(job.due_date);
        const hoursDifference = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursDifference <= 48; // Jobs due within 48 hours
      });
  };
  
  const upcomingDueJobs = getUpcomingDueJobs();
  const jobDetails = getJobDetails();
  const isCompatible = areJobsCompatible();
  const showBatchRecommendation = shouldRecommend && selectedJobs.length < MIN_RECOMMENDED_JOBS;

  return (
    <div className="flex flex-col gap-2">
      {showBatchRecommendation && (
        <div className="text-xs bg-amber-50 border border-amber-200 p-2 rounded-md text-amber-800 flex items-center gap-2 mb-2">
          <Info size={14} />
          <span>
            <strong>Recommendation:</strong> Select at least {MIN_RECOMMENDED_JOBS} jobs to create an efficient batch.
          </span>
        </div>
      )}
      
      <div className="flex gap-2 items-center">
        <Button 
          onClick={handleBatchClick} 
          disabled={selectedJobs.length === 0 || !isCompatible}
          variant={isCompatible ? "default" : "destructive"}
          className="flex gap-2"
        >
          {selectedJobs.length > 0 ? (
            <>
              <FileCheck className="h-4 w-4" />
              Batch {selectedJobs.length} Jobs
            </>
          ) : (
            "Create Batch"
          )}
        </Button>
        
        {optimization && selectedJobs.length > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="flex gap-1 items-center">
                  <LayoutGrid className="h-3 w-3" />
                  {optimization.sheetsRequired} sheets ({Math.round(optimization.slotUtilization)}% utilization)
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sheet utilization: {Math.round(optimization.slotUtilization)}%</p>
                <p>Slots: {optimization.distribution.reduce((sum, item) => sum + item.slotsNeeded, 0)}/{SLOTS_PER_SHEET}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
              onClick={() => setDialogOpen(false)}
              disabled={isCreatingBatch}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmBatch}
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
    </div>
  );
};

export default BatchControls;
