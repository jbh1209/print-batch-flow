
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FlyerJob, LaminationType } from '@/components/batches/types/FlyerTypes';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { useFlyerJobs } from '@/hooks/useFlyerJobs';

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
  
  // Selected jobs
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  
  // Reset selections when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      // Set initial selections from preSelectedJobs if provided
      if (preSelectedJobs && preSelectedJobs.length > 0) {
        setSelectedJobIds(preSelectedJobs.map(job => job.id));
      } else {
        setSelectedJobIds([]);
      }
    }
  }, [isOpen, preSelectedJobs]);
  
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
          laminationType: laminationType as LaminationType,
          printerType,
          sheetSize
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
          <div className="space-y-4 lg:col-span-1">
            <div>
              <Label htmlFor="paperType">Paper Type</Label>
              <Select value={paperType} onValueChange={setPaperType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select paper type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Matt">Matt</SelectItem>
                  <SelectItem value="Gloss">Gloss</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="paperWeight">Paper Weight</Label>
              <Select value={paperWeight} onValueChange={setPaperWeight}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select paper weight" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="115gsm">115gsm</SelectItem>
                  <SelectItem value="130gsm">130gsm</SelectItem>
                  <SelectItem value="170gsm">170gsm</SelectItem>
                  <SelectItem value="200gsm">200gsm</SelectItem>
                  <SelectItem value="250gsm">250gsm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="lamination">Lamination</Label>
              <Select 
                value={laminationType} 
                onValueChange={(value) => setLaminationType(value as LaminationType)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select lamination type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="matt">Matt</SelectItem>
                  <SelectItem value="gloss">Gloss</SelectItem>
                  <SelectItem value="soft_touch">Soft Touch</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="printerType">Printer Type</Label>
              <Select value={printerType} onValueChange={setPrinterType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select printer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HP 12000">HP 12000</SelectItem>
                  <SelectItem value="HP 7900">HP 7900</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="sheetSize">Sheet Size</Label>
              <Select value={sheetSize} onValueChange={setSheetSize}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select sheet size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="455x640mm">455x640mm</SelectItem>
                  <SelectItem value="530x750mm">530x750mm</SelectItem>
                  <SelectItem value="320x455mm">320x455mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Jobs selection panel */}
          <div className="lg:col-span-2 border rounded-md">
            <div className="p-4 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">Select Jobs</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedJobIds.length} of {availableJobs.length} jobs selected
                  </p>
                </div>
              </div>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedJobIds.length === availableJobs.length && availableJobs.length > 0} 
                        onCheckedChange={handleSelectAllJobs}
                        disabled={availableJobs.length === 0}
                      />
                    </TableHead>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Job #</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Paper</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No jobs available for batching
                      </TableCell>
                    </TableRow>
                  ) : (
                    availableJobs.map((job) => {
                      const isSelected = selectedJobIds.includes(job.id);
                      
                      return (
                        <TableRow key={job.id} className={isSelected ? "bg-primary/5" : undefined}>
                          <TableCell>
                            <Checkbox 
                              checked={isSelected} 
                              onCheckedChange={(checked) => handleSelectJob(job.id, checked === true)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{job.name}</TableCell>
                          <TableCell>{job.job_number}</TableCell>
                          <TableCell>{job.size}</TableCell>
                          <TableCell>
                            {job.paper_weight} {job.paper_type}
                          </TableCell>
                          <TableCell>{job.quantity}</TableCell>
                          <TableCell>
                            {format(new Date(job.due_date), "dd MMM yyyy")}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateBatch} 
            disabled={selectedJobIds.length === 0 || isCreatingBatch}
          >
            {isCreatingBatch ? "Creating Batch..." : "Create Batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
