import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PostcardJob } from "@/components/batches/types/PostcardTypes";
import { usePostcardBatchCreation } from "@/hooks/usePostcardBatchCreation";

// Quick properties panel and jobs selection panel to keep code short
const BatchSettingsPanel = ({paperType, setPaperType, laminationType, setLaminationType}) => (
  <div className="border rounded-md p-4 mb-4">
    <div className="mb-3">
      <label>Paper Type</label>
      <select value={paperType} onChange={e => setPaperType(e.target.value)} className="ml-2 border p-1">
        <option value="350gsm Matt">350gsm Matt</option>
        <option value="350gsm Gloss">350gsm Gloss</option>
      </select>
    </div>
    <div>
      <label>Lamination</label>
      <select value={laminationType} onChange={e => setLaminationType(e.target.value)} className="ml-2 border p-1">
        <option value="none">None</option>
        <option value="matt">Matt</option>
        <option value="gloss">Gloss</option>
      </select>
    </div>
  </div>
);

const JobsSelectionPanel = ({availableJobs, selectedJobIds, handleSelectJob, handleSelectAllJobs}) => (
  <div className="border rounded-md">
    <div className="p-4 border-b flex justify-between"><div className="font-bold">Select Jobs</div>
      <div>{selectedJobIds.length} of {availableJobs.length} selected</div>
      <input 
        type="checkbox"
        aria-label="Select all"
        checked={selectedJobIds.length === availableJobs.length && availableJobs.length > 0}
        disabled={availableJobs.length === 0}
        onChange={e => handleSelectAllJobs(e.target.checked)}
      />
    </div>
    <div className="max-h-64 overflow-auto">
      {availableJobs.map(job => (
        <div key={job.id} className="flex items-center p-2 border-b last:border-b-0">
          <input
            type="checkbox"
            checked={selectedJobIds.includes(job.id)}
            onChange={e => handleSelectJob(job.id, e.target.checked)}
            aria-label="Select job"
            disabled={job.status !== "queued"}
          />
          <span className="ml-2">{job.name} ({job.job_number}) - Qty: {job.quantity}</span>
        </div>
      ))}
    </div>
  </div>
);

const BatchDialogFooter = ({onClose, onCreateBatch, isCreatingBatch, isCreateDisabled}) => (
  <div className="flex justify-end gap-3 pt-4">
    <button type="button" className="px-4 py-2 rounded border" onClick={onClose}>Cancel</button>
    <button
      className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50"
      onClick={onCreateBatch}
      disabled={isCreateDisabled || isCreatingBatch}
    >
      {isCreatingBatch ? "Creating Batch..." : "Create Batch"}
    </button>
  </div>
);

// ----------------- POSTCARD BATCH CREATE DIALOG COMPONENT START -----------------

type PostcardBatchCreateDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedJobs?: PostcardJob[];
};

const PostcardBatchCreateDialog = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedJobs = [],
}: PostcardBatchCreateDialogProps) => {
  const { jobs, isCreatingBatch, createBatch } = usePostcardBatchCreation();
  const availableJobs = jobs.filter(j => j.status === "queued");

  const [paperType, setPaperType] = useState("350gsm Matt");
  const [laminationType, setLaminationType] = useState("none");
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  // Sync preSelectedJobs on open
  useEffect(() => {
    if (isOpen && preSelectedJobs && preSelectedJobs.length > 0) setSelectedJobIds(preSelectedJobs.map(j => j.id));
    else if (isOpen) setSelectedJobIds([]);
  }, [isOpen, preSelectedJobs]);

  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) setSelectedJobIds([...selectedJobIds, jobId]);
    else setSelectedJobIds(selectedJobIds.filter(id => id !== jobId));
  };
  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) setSelectedJobIds(availableJobs.map(j => j.id));
    else setSelectedJobIds([]);
  };

  const handleCreateBatch = async () => {
    const selectedJobs = jobs.filter(j => selectedJobIds.includes(j.id));
    await createBatch(selectedJobs, paperType, laminationType);
    onSuccess();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Postcard Batch</DialogTitle>
          <DialogDescription>Select jobs and set batch properties</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3">
          <BatchSettingsPanel
            paperType={paperType}
            setPaperType={setPaperType}
            laminationType={laminationType}
            setLaminationType={setLaminationType}
          />
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
};
export default PostcardBatchCreateDialog;
