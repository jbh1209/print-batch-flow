
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useFlyerBatches } from "@/hooks/useFlyerBatches";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import FlyerBatchDetails from "./FlyerBatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LaminationType, FlyerJob } from "@/components/batches/types/FlyerTypes";
import { FlyerJobsList } from "@/components/flyers/FlyerJobsList";

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

  const { fetchJobs } = useFlyerJobs();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<FlyerJob[]>([]);
  const [batchName, setBatchName] = useState("");
  const [paperType, setPaperType] = useState("Gloss");
  const [paperWeight, setPaperWeight] = useState("130gsm");
  const [laminationType, setLaminationType] = useState<LaminationType>("none");
  const [isCreating, setIsCreating] = useState(false);
  const [printerType, setPrinterType] = useState("HP 12000");
  const [sheetSize, setSheetSize] = useState("530x750mm");

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
      
      const batchData = {
        name: batchName,
        paper_type: paperType,
        paper_weight: paperWeight,
        lamination_type: laminationType, // This is now properly typed as LaminationType
        due_date: new Date().toISOString(),
        printer_type: printerType,
        sheet_size: sheetSize
      };
      
      await createBatch(selectedJobs, batchData);
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
            <FileText className="h-6 w-6 mr-2 text-batchflow-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Flyer Batches</h1>
          </div>
          <p className="text-gray-500 mt-1">View and manage all your flyer batches</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Flyer Batch</DialogTitle>
            <DialogDescription>
              Select jobs to include in this batch and set batch properties
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Batch settings panel */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="batchName">Batch Name</Label>
                <Input
                  id="batchName"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="Enter batch name"
                  className="mt-1"
                />
              </div>
              
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
              
              <div className="pt-4">
                <Button 
                  onClick={handleCreateBatch} 
                  disabled={selectedJobs.length === 0 || !batchName || isCreating}
                  className="w-full"
                >
                  {isCreating ? "Creating..." : "Create Batch"}
                </Button>
              </div>
            </div>
            
            {/* Jobs selection panel */}
            <div className="md:col-span-2">
              <Label className="mb-2 block">Select Jobs to Include</Label>
              <FlyerJobsList 
                onSelectJobs={setSelectedJobs}
                onCreateBatchClick={handleCreateBatch}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlyerBatches;
