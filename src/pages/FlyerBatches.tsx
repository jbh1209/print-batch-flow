
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFlyerBatches } from "@/hooks/useFlyerBatches";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import JobsHeader from "@/components/business-cards/JobsHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import FlyerBatchDetails from "./FlyerBatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const FlyerBatches = () => {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  
  const {
    batches,
    isLoading,
    error,
    fetchBatches,
    createBatch,
    handleViewPDF
  } = useFlyerBatches();

  const { jobs: flyerJobs, isLoading: jobsLoading, error: jobsError, fetchJobs } = useFlyerJobs();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [batchName, setBatchName] = useState("");
  const [paperType, setPaperType] = useState("Gloss");
  const [paperWeight, setPaperWeight] = useState("130gsm");
  const [laminationType, setLaminationType] = useState("none");
  const [isCreating, setIsCreating] = useState(false);
  const [printerType, setPrinterType] = useState("HP 12000");
  const [sheetSize, setSheetSize] = useState("530x750mm");

  // Filter jobs that are not batched already
  const availableJobs = flyerJobs.filter(job => job.status === "queued");

  // Convert FlyerBatch[] to BatchSummary[] for BatchesWrapper
  const batchSummaries: BatchSummary[] = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Flyers",
    sheets_required: batch.sheets_required,
    lamination_type: batch.lamination_type,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    created_at: batch.created_at
  }));

  // Toggle job selection
  const toggleJobSelection = (jobId: string) => {
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    } else {
      setSelectedJobs([...selectedJobs, jobId]);
    }
  };

  // Handle batch creation
  const handleCreateBatch = async () => {
    if (!batchName) {
      toast.error("Please enter a batch name");
      return;
    }
    
    if (selectedJobs.length === 0) {
      toast.error("Please select at least one job");
      return;
    }
    
    try {
      setIsCreating(true);
      
      // Get full job objects for selected jobs
      const jobsToAdd = flyerJobs.filter(job => selectedJobs.includes(job.id));
      
      const batchData = {
        name: batchName,
        paper_type: paperType,
        paper_weight: paperWeight,
        lamination_type: laminationType,
        due_date: new Date().toISOString(),
        printer_type: printerType,
        sheet_size: sheetSize
      };
      
      await createBatch(jobsToAdd, batchData);
      toast.success("Batch created successfully");
      setIsCreateDialogOpen(false);
      
      // Refresh data
      fetchBatches();
      fetchJobs();
      
      // Reset form
      setBatchName("");
      setSelectedJobs([]);
      
    } catch (error) {
      console.error("Error creating batch:", error);
      toast.error("Failed to create batch");
    } finally {
      setIsCreating(false);
    }
  };

  // If we're viewing a specific batch, render the BatchDetails component
  if (batchId) {
    return <FlyerBatchDetails />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center">
            <h1 className="text-2xl font-bold tracking-tight">Flyer Batches</h1>
          </div>
          <p className="text-gray-500 mt-1">View and manage all your flyer batches</p>
        </div>
        <Button 
          onClick={() => {
            setIsCreateDialogOpen(true); 
            fetchJobs();
          }}
          disabled={jobsLoading}
        >
          Create Batch
        </Button>
      </div>

      {/* Error message if there's an issue fetching data */}
      {error && !isLoading && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading batches</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchBatches}
              >
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <BatchesWrapper 
        batches={batchSummaries}
        isLoading={isLoading}
        error={error}
        onRefresh={fetchBatches}
        onViewPDF={handleViewPDF}
        onDeleteBatch={(id) => console.log('Delete batch', id)}
      />

      {/* Create Batch Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Flyer Batch</DialogTitle>
            <DialogDescription>
              Select jobs to include in this batch and set batch properties
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="batchName" className="text-right">
                Batch Name
              </Label>
              <Input
                id="batchName"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Enter batch name"
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paperType" className="text-right">
                Paper Type
              </Label>
              <Select value={paperType} onValueChange={setPaperType}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select paper type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Matt">Matt</SelectItem>
                  <SelectItem value="Gloss">Gloss</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paperWeight" className="text-right">
                Paper Weight
              </Label>
              <Select value={paperWeight} onValueChange={setPaperWeight}>
                <SelectTrigger className="col-span-3">
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
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lamination" className="text-right">
                Lamination
              </Label>
              <Select value={laminationType} onValueChange={setLaminationType}>
                <SelectTrigger className="col-span-3">
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
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="printerType" className="text-right">
                Printer Type
              </Label>
              <Select value={printerType} onValueChange={setPrinterType}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select printer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HP 12000">HP 12000</SelectItem>
                  <SelectItem value="HP 7900">HP 7900</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sheetSize" className="text-right">
                Sheet Size
              </Label>
              <Select value={sheetSize} onValueChange={setSheetSize}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select sheet size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="455x640mm">455x640mm</SelectItem>
                  <SelectItem value="530x750mm">530x750mm</SelectItem>
                  <SelectItem value="320x455mm">320x455mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2">
              <Label className="mb-2 block">Select Jobs to Include</Label>
              
              {jobsLoading ? (
                <div className="text-center py-8">
                  <div className="h-8 w-8 rounded-full border-t-2 border-b-2 border-primary animate-spin mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading jobs...</p>
                </div>
              ) : jobsError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-500">Failed to load jobs</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={fetchJobs}>
                    Try Again
                  </Button>
                </div>
              ) : availableJobs.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <p className="text-sm text-gray-500">No available jobs to batch</p>
                  <p className="text-xs text-gray-400 mt-1">Create new jobs first</p>
                </div>
              ) : (
                <ScrollArea className="h-[240px] border rounded-lg p-2">
                  <div className="space-y-2">
                    {availableJobs.map(job => (
                      <div key={job.id} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                        <Checkbox
                          checked={selectedJobs.includes(job.id)}
                          onCheckedChange={() => toggleJobSelection(job.id)}
                          id={`job-${job.id}`}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`job-${job.id}`}
                            className="font-medium cursor-pointer"
                          >
                            {job.name}
                          </Label>
                          <p className="text-xs text-gray-500">
                            {job.size} • {job.quantity} pcs • {job.paper_weight} {job.paper_type}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateBatch} 
              disabled={selectedJobs.length === 0 || !batchName || isCreating}
            >
              {isCreating ? "Creating..." : "Create Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlyerBatches;
