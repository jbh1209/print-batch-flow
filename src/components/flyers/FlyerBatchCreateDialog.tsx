
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { useFlyerJobs } from '@/hooks/useFlyerJobs';
import { BatchSettingsPanel } from './components/batch-dialog/BatchSettingsPanel';
import { JobsSelectionPanel } from './components/batch-dialog/JobsSelectionPanel';
import { BatchDialogFooter } from './components/batch-dialog/BatchDialogFooter';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { productConfigs } from '@/config/productTypes';

interface FlyerBatchCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedJobs?: FlyerJob[];
}

export function FlyerBatchCreateDialog({ 
  isOpen, 
  onClose, 
  onSuccess,
  preSelectedJobs = [] 
}: FlyerBatchCreateDialogProps) {
  const { jobs, isCreatingBatch, createBatch } = useFlyerJobs();
  
  // Filter only queued jobs that can be batched
  const availableJobs = jobs.filter(job => job.status === 'queued');
  
  // Batch properties
  const [paperType, setPaperType] = useState("Gloss");
  const [paperWeight, setPaperWeight] = useState("130gsm");
  const [laminationType, setLaminationType] = useState<LaminationType>("none");
  const [printerType, setPrinterType] = useState("HP 12000");
  const [sheetSize, setSheetSize] = useState("530x750mm");
  
  // Get default SLA from product config
  const defaultSla = productConfigs["Flyers"].slaTargetDays;
  const [slaTargetDays, setSlaTargetDays] = useState(defaultSla);
  
  // Selected jobs
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  
  // Reset to default values when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSlaTargetDays(defaultSla);
      // Set initial selections from preSelectedJobs if provided
      if (preSelectedJobs && preSelectedJobs.length > 0) {
        setSelectedJobIds(preSelectedJobs.map(job => job.id));
      } else {
        setSelectedJobIds([]);
      }
    }
  }, [isOpen, preSelectedJobs, defaultSla]);
  
  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobIds([...selectedJobIds, jobId]);
    } else {
      setSelectedJobIds(selectedJobIds.filter(id => id !== jobId));
    }
  };
  
  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobIds(availableJobs.map(job => job.id));
    } else {
      setSelectedJobIds([]);
    }
  };

  // Create a wrapper function to handle the setState call
  const handleLaminationTypeChange = (value: LaminationType) => {
    setLaminationType(value);
  };
  
  const handleCreateBatch = async () => {
    try {
      // Get the full job objects for the selected IDs
      const selectedJobs = jobs.filter(job => selectedJobIds.includes(job.id));
      
      await createBatch(
        selectedJobs,
        {
          paperType,
          paperWeight,
          laminationType: laminationType as LaminationType,
          printerType,
          sheetSize,
          slaTargetDays: slaTargetDays
        }
      );
      
      onSuccess();
    } catch (error) {
      console.error('Error creating batch:', error);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Flyer Batch</DialogTitle>
          <DialogDescription>
            Select jobs to include in this batch and set batch properties
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Batch settings panel */}
          <BatchSettingsPanel 
            paperType={paperType}
            setPaperType={setPaperType}
            paperWeight={paperWeight}
            setPaperWeight={setPaperWeight}
            laminationType={laminationType}
            setLaminationType={handleLaminationTypeChange}
            printerType={printerType}
            setPrinterType={setPrinterType}
            sheetSize={sheetSize}
            setSheetSize={setSheetSize}
          />
          
          <div className="space-y-4">
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
                Default for flyers: {defaultSla} days
              </p>
            </div>
          </div>
          
          {/* Jobs selection panel */}
          <JobsSelectionPanel
            availableJobs={availableJobs}
            selectedJobIds={selectedJobIds}
            handleSelectJob={handleSelectJob}
            handleSelectAllJobs={handleSelectAllJobs}
          />
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
