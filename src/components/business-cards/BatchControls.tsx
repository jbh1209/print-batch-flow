import { useState, useEffect } from "react";
import { Job } from "./JobsTable";
import { useBatchCreation } from "@/hooks/useBatchCreation";
import { MIN_RECOMMENDED_JOBS } from "@/utils/batchOptimizationHelpers";
import BatchButton from "./batch-controls/BatchButton";
import BatchConfirmDialog from "./batch-controls/BatchConfirmDialog";
import BatchRecommendation from "./batch-controls/BatchRecommendation";
import { useBatchHelpers } from "./batch-controls/useBatchHelpers";
import { toast } from "sonner";
import { BatchCreationResult } from "@/hooks/generic/batch-operations/types/batchCreationTypes";

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
  const { createBatch, isCreatingBatch, generateBatchNumber } = useBatchCreation();
  
  // Use our custom hook to get batch-related helper data
  const { 
    optimization, 
    isCompatible, 
    upcomingDueJobs, 
    showBatchRecommendation 
  } = useBatchHelpers(selectedJobs, allAvailableJobs);

  // Generate batch name when dialog opens or selection changes
  useEffect(() => {
    if (dialogOpen && selectedJobs.length > 0) {
      const fetchBatchName = async () => {
        const newBatchName = await generateBatchNumber("business_cards");
        setBatchName(newBatchName);
      };
      fetchBatchName();
    }
  }, [dialogOpen, selectedJobs, generateBatchNumber]);

  const handleBatchClick = () => {
    if (selectedJobs.length === 0) {
      return;
    }
    
    setDialogOpen(true);
  };

  const handleConfirmBatch = async () => {
    try {
      // Use the auto-generated batch name - no custom name
      const result = await createBatch(selectedJobs);
      
      if (result) {
        setDialogOpen(false);
        
        // Check response type
        if (typeof result === 'object' && 'success' in result) {
          const batchResult = result as BatchCreationResult;
          
          if (batchResult.success) {
            if (batchResult.jobsUpdated < selectedJobs.length) {
              toast.warning(`Batch created but only ${batchResult.jobsUpdated} of ${selectedJobs.length} jobs were added`);
            } else {
              toast.success(`Batch created successfully with all ${batchResult.jobsUpdated} jobs`);
            }
          } else {
            toast.error(`Failed to create batch: ${batchResult.error}`);
          }
        } else {
          // Legacy result handling (true/false)
          toast.success(`Batch created successfully`);
        }
        
        // Refresh the jobs list regardless to show the most current state
        onBatchComplete();
      }
    } catch (err) {
      console.error("Error creating batch:", err);
      toast.error(`Failed to create batch: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <BatchRecommendation 
        showBatchRecommendation={showBatchRecommendation}
        minRecommendedJobs={MIN_RECOMMENDED_JOBS}
      />
      
      <BatchButton
        selectedJobsCount={selectedJobs.length}
        isCompatible={isCompatible}
        onClick={handleBatchClick}
        optimization={optimization}
      />
      
      <BatchConfirmDialog
        isOpen={dialogOpen}
        setIsOpen={setDialogOpen}
        selectedJobs={selectedJobs}
        batchName={batchName}
        onConfirm={handleConfirmBatch}
        isCreatingBatch={isCreatingBatch}
        optimization={optimization}
        upcomingDueJobs={upcomingDueJobs}
        onSelectJob={onSelectJob}
      />
    </div>
  );
};

export default BatchControls;
