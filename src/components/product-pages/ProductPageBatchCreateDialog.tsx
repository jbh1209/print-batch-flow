
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProductPageJob } from '@/components/product-pages/types/ProductPageTypes';
import { useProductPageJobs } from '@/hooks/product-pages/useProductPageJobs';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { productConfigs } from '@/config/productTypes';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BatchCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedJobs?: ProductPageJob[];
}

export function ProductPageBatchCreateDialog({ 
  isOpen, 
  onClose, 
  onSuccess,
  preSelectedJobs = [] 
}: BatchCreateDialogProps) {
  const { jobs, isCreatingBatch, createBatch } = useProductPageJobs();
  
  // Filter only queued jobs that can be batched
  const availableJobs = jobs.filter(job => job.status === 'queued');
  
  // Batch properties
  const [paperType, setPaperType] = useState("Gloss");
  const [paperWeight, setPaperWeight] = useState("130gsm");
  const [printerType, setPrinterType] = useState("HP 12000");
  const [sheetSize, setSheetSize] = useState("530x750mm");
  
  // Get default SLA from product config
  const defaultSla = 3; // Default value
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
  
  const handleCreateBatch = async () => {
    try {
      // Get the full job objects for the selected IDs
      const selectedJobs = jobs.filter(job => selectedJobIds.includes(job.id));
      
      await createBatch(
        selectedJobs,
        {
          paperType,
          paperWeight,
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
          <DialogTitle>Create Product Page Batch</DialogTitle>
          <DialogDescription>
            Select jobs to include in this batch and set batch properties
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Batch settings panel */}
          <div className="space-y-4 lg:col-span-2">
            <h3 className="text-lg font-medium">Batch Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paperType">Paper Type</Label>
                <Select value={paperType} onValueChange={setPaperType}>
                  <SelectTrigger id="paperType">
                    <SelectValue placeholder="Select paper type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gloss">Gloss</SelectItem>
                    <SelectItem value="Matt">Matt</SelectItem>
                    <SelectItem value="Silk">Silk</SelectItem>
                    <SelectItem value="Recycled">Recycled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="paperWeight">Paper Weight</Label>
                <Select value={paperWeight} onValueChange={setPaperWeight}>
                  <SelectTrigger id="paperWeight">
                    <SelectValue placeholder="Select paper weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="115gsm">115gsm</SelectItem>
                    <SelectItem value="130gsm">130gsm</SelectItem>
                    <SelectItem value="150gsm">150gsm</SelectItem>
                    <SelectItem value="170gsm">170gsm</SelectItem>
                    <SelectItem value="250gsm">250gsm</SelectItem>
                    <SelectItem value="350gsm">350gsm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="printerType">Printer Type</Label>
                <Select value={printerType} onValueChange={setPrinterType}>
                  <SelectTrigger id="printerType">
                    <SelectValue placeholder="Select printer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HP 12000">HP 12000</SelectItem>
                    <SelectItem value="Xerox Iridesse">Xerox Iridesse</SelectItem>
                    <SelectItem value="Konica Minolta">Konica Minolta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sheetSize">Sheet Size</Label>
                <Select value={sheetSize} onValueChange={setSheetSize}>
                  <SelectTrigger id="sheetSize">
                    <SelectValue placeholder="Select sheet size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A3">A3</SelectItem>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="SRA3">SRA3</SelectItem>
                    <SelectItem value="530x750mm">530x750mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
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
              </div>
            </div>
          </div>
          
          {/* Jobs selection panel */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Select Jobs</h3>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="selectAll"
                    checked={selectedJobIds.length === availableJobs.length && availableJobs.length > 0}
                    onCheckedChange={handleSelectAllJobs}
                  />
                  <Label htmlFor="selectAll">Select All</Label>
                </div>
              </div>
              
              {availableJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No jobs available for batching
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {availableJobs.map((job) => (
                      <div 
                        key={job.id} 
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                      >
                        <div className="flex-1 truncate">
                          <div className="font-medium">{job.name}</div>
                          <div className="text-sm text-gray-500">{job.job_number}</div>
                        </div>
                        <Checkbox 
                          checked={selectedJobIds.includes(job.id)}
                          onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              
              <div className="text-sm text-gray-500">
                {selectedJobIds.length} of {availableJobs.length} jobs selected
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateBatch} 
            disabled={selectedJobIds.length === 0 || isCreatingBatch}
          >
            {isCreatingBatch ? 'Creating...' : 'Create Batch'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
