
import { useSearchParams, useNavigate } from "react-router-dom";
import { useBusinessCardBatches } from "@/hooks/useBusinessCardBatches";
import JobsHeader from "@/components/business-cards/JobsHeader";
import BatchDetails from "@/components/batches/BatchDetails";
import BatchesWrapper from "@/components/batches/business-cards/BatchesWrapper";
import { StandardDeleteBatchDialog } from "@/components/batches/StandardDeleteBatchDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import { useBatchDeletion } from "@/hooks/useBatchDeletion";
import BusinessCardJobsContent from "@/components/business-cards/BusinessCardJobsContent";

const BusinessCardBatches = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const batchId = searchParams.get('batchId');
  const activeTab = searchParams.get('tab') || 'batches';
  
  const {
    batches,
    isLoading,
    error,
    fetchBatches,
    handleViewPDF,
    handleViewBatchDetails
  } = useBusinessCardBatches(batchId);

  // Use the new standardized batch deletion hook
  const {
    batchToDelete,
    isDeleting,
    handleDeleteBatch,
    initiateDeletion,
    cancelDeletion
  } = useBatchDeletion({
    productType: "Business Cards",
    onSuccess: fetchBatches // Refresh the list after successful deletion
  });

  // Convert Batch[] to BatchSummary[] for BatchesWrapper
  const batchSummaries: BatchSummary[] = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    due_date: batch.due_date,
    status: batch.status,
    product_type: "Business Cards",
    sheets_required: batch.sheets_required,
    lamination_type: batch.lamination_type,
    front_pdf_url: batch.front_pdf_url,
    back_pdf_url: batch.back_pdf_url,
    created_at: batch.created_at
  }));

  // Find the batch name for the dialog
  const batchToDeleteName = batchToDelete 
    ? batches.find(b => b.id === batchToDelete)?.name 
    : undefined;

  // If we're viewing a specific batch, render the BatchDetails component
  if (batchId) {
    return (
      <BatchDetails 
        batchId={batchId} 
        productType="Business Cards" 
        backUrl="/batchflow/batches/business-cards" 
      />
    );
  }

  const handleTabChange = (tab: string) => {
    navigate(`/batchflow/batches/business-cards?tab=${tab}`);
  };

  return (
    <div className="space-y-6">
      <JobsHeader 
        title="Business Card Management" 
        subtitle="View and manage business card jobs and batches" 
      />

      <div className="bg-card rounded-lg border shadow-sm">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="border-b bg-muted/5">
            <TabsList className="grid w-full max-w-md grid-cols-2 mx-auto bg-transparent border-0 h-12">
              <TabsTrigger 
                value="jobs" 
                className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Jobs
              </TabsTrigger>
              <TabsTrigger 
                value="batches"
                className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Batches
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="p-6">
            <TabsContent value="jobs" className="mt-0 space-y-0">
              <BusinessCardJobsContent />
            </TabsContent>
            
            <TabsContent value="batches" className="mt-0 space-y-6">
              {/* Error message if there's an issue fetching data */}
              {error && !isLoading && (
                <Alert variant="destructive">
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
                onDeleteBatch={initiateDeletion}
                onViewDetails={handleViewBatchDetails}
              />

              {/* Standardized Delete Confirmation Dialog */}
              <StandardDeleteBatchDialog
                isOpen={!!batchToDelete}
                isDeleting={isDeleting}
                batchName={batchToDeleteName}
                onCancel={cancelDeletion}
                onConfirm={handleDeleteBatch}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default BusinessCardBatches;
