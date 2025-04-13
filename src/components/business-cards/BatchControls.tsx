
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
import { Loader, FileCheck, AlertCircle } from "lucide-react";
import { Job } from "./JobsTable";
import { useBatchCreation } from "@/hooks/useBatchCreation";

interface BatchControlsProps {
  selectedJobs: Job[];
  onBatchComplete: () => void;
}

const BatchControls = ({ selectedJobs, onBatchComplete }: BatchControlsProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchName, setBatchName] = useState("");
  const { createBatch, isCreatingBatch } = useBatchCreation();

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
    const sheetsRequired = Math.ceil(totalCards / 24); // 24 cards per sheet (3x8 layout)
    
    return {
      totalJobs: selectedJobs.length,
      totalCards,
      sheetsRequired,
      laminationTypes: Array.from(laminationTypes)
    };
  };
  
  const jobDetails = getJobDetails();
  const isCompatible = areJobsCompatible();

  return (
    <div>
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
              
              {!isCompatible && (
                <div className="mt-2 flex items-center text-red-500 gap-1">
                  <AlertCircle className="h-4 w-4" />
                  <span>Warning: Jobs have different lamination types</span>
                </div>
              )}
            </div>
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
