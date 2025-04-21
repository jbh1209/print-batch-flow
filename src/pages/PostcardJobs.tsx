
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePostcardJobs } from "@/hooks/usePostcardJobs";
import { PostcardJobsTable } from "@/components/postcards/PostcardJobsTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const PostcardJobs = () => {
  const navigate = useNavigate();
  const {
    jobs,
    isLoading,
    error,
    fetchJobs,
    handleViewJob,
    handleDeleteJob,
    selectedJobs,
    toggleJobSelection,
    selectAllJobs,
    clearSelection,
    isCreatingBatch,
    handleCreateBatch,
  } = usePostcardJobs();

  // Simple modal state for batch creation dialog
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  // For demo purposes: Selects paperType and lamination in dialog
  const [paperType, setPaperType] = useState<"350gsm Matt" | "350gsm Gloss">("350gsm Matt");
  const [laminationType, setLaminationType] = useState<"matt" | "gloss" | "soft_touch" | "none">("matt");

  // Only allow selection of "queued" jobs with no batch
  const selectableJobIds = jobs.filter(j => j.status === "queued" && !j.batch_id).map(j => j.id);

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      selectAllJobs();
    } else {
      clearSelection();
    }
  };

  const openBatchDialog = () => setIsBatchDialogOpen(true);
  const closeBatchDialog = () => setIsBatchDialogOpen(false);

  // Handle batch create workflow
  const onConfirmBatch = async () => {
    await handleCreateBatch(paperType, laminationType);
    setIsBatchDialogOpen(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Postcard Jobs</h1>
          <p className="text-gray-500 mt-1">Manage your postcard print jobs</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="flex items-center gap-1"
            onClick={() => navigate("/batches/postcards")}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </Button>
          <Button onClick={() => navigate("/batches/postcards/jobs/new")}>
            <Plus size={16} className="mr-1" />
            Add New Job
          </Button>
        </div>
      </div>

      {/* Control bar for batch selection */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="text-sm text-muted-foreground">
          {selectedJobs.length} of {selectableJobIds.length} jobs selected
        </div>
        <div>
          <Button
            disabled={selectedJobs.length === 0}
            onClick={openBatchDialog}
          >
            Create Batch
          </Button>
          {selectedJobs.length > 0 && (
            <Button 
              variant="ghost"
              className="ml-2"
              onClick={clearSelection}
              size="sm"
            >
              Clear Selection
            </Button>
          )}
        </div>
      </div>

      {error && !isLoading && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PostcardJobsTable
        jobs={jobs}
        isLoading={isLoading}
        error={error}
        onViewJob={handleViewJob}
        onDeleteJob={handleDeleteJob}
        onRefresh={fetchJobs}
        selectedJobs={selectedJobs}
        onSelectJob={toggleJobSelection}
        onSelectAllJobs={handleSelectAll}
        selectableJobIds={selectableJobIds}
      />

      {/* Batch dialog modal */}
      <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
        <DialogContent className="w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Create Postcard Batch</DialogTitle>
            <DialogDescription>
              Set batch options, then confirm. ({selectedJobs.length} jobs)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium">Paper Type</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={paperType}
                onChange={e => setPaperType(e.target.value as "350gsm Matt" | "350gsm Gloss")}
              >
                <option value="350gsm Matt">350gsm Matt</option>
                <option value="350gsm Gloss">350gsm Gloss</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Lamination</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={laminationType}
                onChange={e => setLaminationType(e.target.value as "matt" | "gloss" | "soft_touch" | "none")}
              >
                <option value="matt">Matt</option>
                <option value="gloss">Gloss</option>
                <option value="soft_touch">Soft Touch</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button 
              variant="ghost"
              onClick={closeBatchDialog}
              disabled={isCreatingBatch}
            >
              Cancel
            </Button>
            <Button 
              onClick={onConfirmBatch}
              disabled={isCreatingBatch || selectedJobs.length === 0}
            >
              {isCreatingBatch ? "Creating..." : "Create Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostcardJobs;
