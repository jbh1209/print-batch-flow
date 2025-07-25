
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { productConfigs } from "@/config/productTypes";

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
  onSlaChange?: (value: number) => void;
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
  onSelectJob,
  onSlaChange
}: BatchConfirmDialogProps) => {
  // Get default SLA from product config - use "BusinessCards" key instead of "Business Cards"
  // and add a fallback value of 3 days
  const defaultSla = productConfigs["BusinessCards"]?.slaTargetDays || 3;
  const [slaTargetDays, setSlaTargetDays] = useState(defaultSla); 
  
  // Reset to default when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSlaTargetDays(defaultSla);
    }
  }, [isOpen, defaultSla]);
  
  // Handle SLA change
  const handleSlaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setSlaTargetDays(value);
      if (onSlaChange) {
        onSlaChange(value);
      }
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
  
  const isCompatible = areJobsCompatible();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-2 sm:space-y-3">
          <DialogTitle className="text-lg sm:text-xl">Create New Batch</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            You are about to create a batch with {selectedJobs.length} jobs
            {!isCompatible && (
              <div className="text-destructive mt-2 font-medium text-sm">
                Warning: Selected jobs have different lamination types
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 sm:space-y-6">
          <BatchDetailsSection
            selectedJobs={selectedJobs}
            batchName={batchName}
            optimization={optimization}
            isCompatible={isCompatible}
          />

          <div className="space-y-2">
            <Label htmlFor="slaTargetDays" className="text-sm font-medium">
              SLA Target Days
            </Label>
            <Input
              id="slaTargetDays"
              type="number"
              min="1"
              value={slaTargetDays}
              onChange={handleSlaChange}
              className="w-full"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Default for business cards: {defaultSla} days
            </p>
          </div>

          <UpcomingDueJobsSection 
            upcomingDueJobs={upcomingDueJobs}
            onSelectJob={onSelectJob}
          />
        </div>
        
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
