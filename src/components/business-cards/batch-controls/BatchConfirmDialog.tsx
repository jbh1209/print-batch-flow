
import { 
  Dialog,
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Job } from "../JobsTable";
import { BatchOptimization } from "@/utils/batchOptimizationHelpers";
import BatchDetailsSection from "./dialog/BatchDetailsSection";
import UpcomingDueJobsSection from "./dialog/UpcomingDueJobsSection";
import BatchDialogFooter from "./dialog/BatchDialogFooter";

interface BatchConfirmDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedJobs: Job[];
  batchName: string;
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
  onConfirm,
  isCreatingBatch,
  optimization,
  upcomingDueJobs,
  onSelectJob
}: BatchConfirmDialogProps) => {
  // Determine if selected jobs are compatible for batching
  const areJobsCompatible = () => {
    if (selectedJobs.length <= 1) {
      return true; // Single job or no jobs is always compatible
    }
    
    // All jobs should have the same lamination type
    const firstLamination = selectedJobs[0].lamination_type;
    return selectedJobs.every(job => job.lamination_type === firstLamination);
  };
  
  const isCompatible = areJobsCompatible();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Batch</DialogTitle>
          <DialogDescription>
            You are about to create a batch with {selectedJobs.length} jobs
          </DialogDescription>
        </DialogHeader>
        
        <BatchDetailsSection
          selectedJobs={selectedJobs}
          batchName={batchName}
          optimization={optimization}
          isCompatible={isCompatible}
        />

        <UpcomingDueJobsSection 
          upcomingDueJobs={upcomingDueJobs}
          onSelectJob={onSelectJob}
        />
        
        <BatchDialogFooter
          onCancel={() => setIsOpen(false)}
          onConfirm={onConfirm}
          isCreatingBatch={isCreatingBatch}
        />
      </DialogContent>
    </Dialog>
  );
};

export default BatchConfirmDialog;
