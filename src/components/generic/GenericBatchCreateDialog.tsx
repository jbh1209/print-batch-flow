
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
  const [paperType, setPaperType] = useState(config.availablePaperTypes?.[0] || "");
  const [paperWeight, setPaperWeight] = useState(config.availablePaperWeights?.[0] || "");
  const [laminationType, setLaminationType] = useState<LaminationType>(
    config.availableLaminationTypes?.[0] || "none"
  );
  const [printerType, setPrinterType] = useState("HP 12000");
  const [sheetSize, setSheetSize] = useState("530x750mm");
  
  // Use the product config's SLA as default
  const [slaTargetDays, setSlaTargetDays] = useState(config.slaTargetDays);
  
  // Selected jobs
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  
  useEffect(() => {
    if (isOpen) {
      if (preSelectedJobs && preSelectedJobs.length > 0) {
        setSelectedJobIds(preSelectedJobs.map(job => job.id));
      } else {
        setSelectedJobIds([]);
      }
      // Reset SLA to the product config default when the dialog opens
      setSlaTargetDays(config.slaTargetDays);
      
      // Reset paper type selection to the first available option from config
      if (config.availablePaperTypes && config.availablePaperTypes.length > 0) {
        setPaperType(config.availablePaperTypes[0]);
      }
      
      // Reset lamination type to the first available option
      if (config.availableLaminationTypes && config.availableLaminationTypes.length > 0) {
        setLaminationType(config.availableLaminationTypes[0]);
      }
    }
  }, [isOpen, preSelectedJobs, config]);
  
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
        laminationType,
        slaTargetDays
      });
      
      const batchResult = await createBatch(
        selectedJobs,
        {
          paperType,
          paperWeight,
          laminationType: laminationType as LaminationType,
          printerType,
          sheetSize,
          slaTargetDays: Number(slaTargetDays)
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
              availablePaperTypes={config.availablePaperTypes}
              availableLaminationTypes={config.availableLaminationTypes}
              availablePaperWeights={config.availablePaperWeights}
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
