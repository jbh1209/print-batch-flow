
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProductConfig, BaseJob, LaminationType } from '@/config/productTypes';
import { BatchSettingsPanel } from '@/components/flyers/components/batch-dialog/BatchSettingsPanel';
import { JobsSelectionPanel } from '@/components/flyers/components/batch-dialog/JobsSelectionPanel';
import { BatchDialogFooter } from '@/components/flyers/components/batch-dialog/BatchDialogFooter';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface GenericBatchCreateDialogProps {
  config: ProductConfig;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedJobs?: BaseJob[];
  createBatch: (jobs: BaseJob[], properties: any) => Promise<any>;
  isCreatingBatch: boolean;
}

export function GenericBatchCreateDialog({
  config,
  isOpen, 
  onClose, 
  onSuccess,
  preSelectedJobs = [],
  createBatch,
  isCreatingBatch
}: GenericBatchCreateDialogProps) {
  // Batch properties
  const [paperType, setPaperType] = useState<string>("");
  const [paperWeight, setPaperWeight] = useState<string>("");
  const [laminationType, setLaminationType] = useState<LaminationType>("none");
  const [printerType, setPrinterType] = useState("HP 12000");
  const [sheetSize, setSheetSize] = useState("530x750mm");
  
  // Use the product config's SLA as default
  const [slaTargetDays, setSlaTargetDays] = useState(config.slaTargetDays);
  
  // Selected jobs
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  
  // Initialize defaults when dialog opens or config changes
  useEffect(() => {
    if (isOpen || config) {
      console.log("Dialog opened with config:", config);
      
      // Set selected jobs from preselected if available
      if (preSelectedJobs && preSelectedJobs.length > 0) {
        setSelectedJobIds(preSelectedJobs.map(job => job.id));
        
        // For stickers, pre-check values from the first job
        if (config.productType === "Stickers" && preSelectedJobs[0]) {
          const firstJob = preSelectedJobs[0];
          if (firstJob.paper_type) {
            console.log("Setting paper type from job:", firstJob.paper_type);
            setPaperType(firstJob.paper_type);
          }
          if (firstJob.lamination_type) {
            console.log("Setting lamination type from job:", firstJob.lamination_type);
            setLaminationType(firstJob.lamination_type as LaminationType);
          }
        }
      } else {
        setSelectedJobIds([]);
      }
      
      // Reset SLA to the product config default when the dialog opens
      setSlaTargetDays(config.slaTargetDays || 3);
      
      // Reset paper type to first available or default
      if (config.availablePaperTypes && config.availablePaperTypes.length > 0) {
        console.log("Setting paper type to:", config.availablePaperTypes[0]);
        setPaperType(config.availablePaperTypes[0]);
      } else {
        setPaperType("Paper"); // Default paper type
      }
      
      // Reset paper weight
      if (config.availablePaperWeights && config.availablePaperWeights.length > 0) {
        setPaperWeight(config.availablePaperWeights[0]);
      } else {
        setPaperWeight("standard");
      }
      
      // Reset lamination type
      if (config.availableLaminationTypes && config.availableLaminationTypes.length > 0) {
        console.log("Setting lamination type to:", config.availableLaminationTypes[0]);
        setLaminationType(config.availableLaminationTypes[0]);
      } else {
        setLaminationType("none");
      }
    }
  }, [isOpen, config, preSelectedJobs]);
  
  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobIds([...selectedJobIds, jobId]);
    } else {
      setSelectedJobIds(selectedJobIds.filter(id => id !== jobId));
    }
  };
  
  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected && preSelectedJobs) {
      setSelectedJobIds(preSelectedJobs.map(job => job.id));
    } else {
      setSelectedJobIds([]);
    }
  };
  
  const handleCreateBatch = async () => {
    try {
      const selectedJobs = preSelectedJobs?.filter(job => selectedJobIds.includes(job.id)) || [];
      
      if (selectedJobs.length === 0) {
        toast.error("Please select at least one job for the batch");
        return;
      }
      
      console.log("Creating batch with properties:", {
        paperType,
        paperWeight,
        laminationType,
        printerType,
        sheetSize,
        slaTargetDays,
        productType: config.productType
      });
      
      // Ensure we have valid values before creating the batch
      if (!paperType) {
        console.warn("Paper type is empty, using default");
      }
      
      if (!laminationType) {
        console.warn("Lamination type is empty, using default");
      }
      
      const batchResult = await createBatch(
        selectedJobs,
        {
          paperType: paperType || "Paper",
          paperWeight: paperWeight || "standard",
          laminationType: laminationType || "none",
          printerType,
          sheetSize,
          slaTargetDays: Number(slaTargetDays) || config.slaTargetDays
        }
      );
      
      if (batchResult) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error("Failed to create batch: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create {config.ui.batchFormTitle}</DialogTitle>
          <DialogDescription>
            Select jobs to include in this batch and set batch properties
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Batch settings panel */}
          <div className="lg:col-span-1 space-y-6">
            <BatchSettingsPanel 
              paperType={paperType}
              setPaperType={setPaperType}
              paperWeight={paperWeight}
              setPaperWeight={setPaperWeight}
              laminationType={laminationType}
              setLaminationType={setLaminationType}
              printerType={printerType}
              setPrinterType={setPrinterType}
              sheetSize={sheetSize}
              setSheetSize={setSheetSize}
              availablePaperTypes={config.availablePaperTypes || ["Paper"]}
              availableLaminationTypes={config.availableLaminationTypes || ["none"]}
              availablePaperWeights={config.availablePaperWeights || ["standard"]}
            />
            
            <div className="space-y-2">
              <Label htmlFor="slaTargetDays">SLA Target Days</Label>
              <Input
                id="slaTargetDays"
                type="number"
                min="1"
                value={slaTargetDays}
                onChange={(e) => setSlaTargetDays(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Default for {config.productType.toLowerCase()}: {config.slaTargetDays} days
              </p>
            </div>
          </div>
          
          {/* Jobs selection panel */}
          <div className="lg:col-span-2">
            <JobsSelectionPanel
              availableJobs={preSelectedJobs as any[]}
              selectedJobIds={selectedJobIds}
              handleSelectJob={handleSelectJob}
              handleSelectAllJobs={handleSelectAllJobs}
            />
          </div>
        </div>
        
        <BatchDialogFooter
          onClose={onClose}
          onCreateBatch={handleCreateBatch}
          isCreatingBatch={isCreatingBatch}
          isCreateDisabled={selectedJobIds.length === 0}
        />
      </DialogContent>
    </Dialog>
  );
}
