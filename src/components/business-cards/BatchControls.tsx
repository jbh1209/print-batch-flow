
import { useState } from "react";
import { Job } from "./JobsTable";
import { useBatchCreation } from "@/hooks/useBatchCreation";
import { MIN_RECOMMENDED_JOBS } from "@/utils/batchOptimizationHelpers";
import BatchButton from "./batch-controls/BatchButton";
import BatchConfirmDialog from "./batch-controls/BatchConfirmDialog";
import BatchRecommendation from "./batch-controls/BatchRecommendation";
import { useBatchHelpers } from "./batch-controls/useBatchHelpers";

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
  const { createBatch, isCreatingBatch } = useBatchCreation();
  
  // Use our custom hook to get batch-related helper data
  const { 
    optimization, 
    isCompatible, 
    upcomingDueJobs, 
    showBatchRecommendation 
  } = useBatchHelpers(selectedJobs, allAvailableJobs);

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
        setBatchName={setBatchName}
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
