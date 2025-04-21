import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PostcardJob, LaminationType } from '@/components/batches/types/PostcardTypes';
import { usePostcardBatchCreation } from '@/hooks/usePostcardBatchCreation';

// Quick properties panel to keep code short
const BatchSettingsPanel = ({paperType, setPaperType, laminationType, setLaminationType}) => (
  <div className="border rounded-md p-4 mb-4">
    <div className="mb-4">
      <Label>Paper Type</Label>
      <Select value={paperType} onValueChange={setPaperType}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Select paper type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="350gsm Matt">350gsm Matt</SelectItem>
          <SelectItem value="350gsm Gloss">350gsm Gloss</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <Label>Lamination</Label>
      <Select value={laminationType} onValueChange={setLaminationType}>
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
  </div>
);

const JobsSelectionPanel = ({availableJobs, selectedJobIds, handleSelectJob, handleSelectAllJobs}) => (
  <div className="border rounded-md">
    <div className="p-4 border-b">
      <div className="flex justify-between">
        <div className="font-bold">Select Jobs</div>
        <div>{selectedJobIds.length} of {availableJobs.length} selected</div>
      </div>
    </div>
    <div className="max-h-64 overflow-auto">
      {availableJobs.map(job => (
        <div key={job.id} className="flex items-center p-2 border-b last:border-b-0">
          <input
            type="checkbox"
            checked={selectedJobIds.includes(job.id)}
            onChange={e => handleSelectJob(job.id, e.target.checked)}
            aria-label="Select job"
          />
          <span className="ml-2">{job.name} ({job.job_number}) - Qty: {job.quantity}</span>
        </div>
      ))}
    </div>
  </div>
);

interface PostcardBatchCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedJobs?: PostcardJob[];
}

const PostcardBatchCreateDialog = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedJobs = [],
}: PostcardBatchCreateDialogProps) => {
  const { jobs, isCreatingBatch, createBatch } = usePostcardBatchCreation();
  const availableJobs = jobs.filter(j => j.status === 'queued');
  
  const [paperType, setPaperType] = useState("350gsm Matt");
  const [laminationType, setLaminationType] = useState<string>("none");
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  // Sync preSelectedJobs on open
  useEffect(() => {
    if (isOpen && preSelectedJobs.length > 0) {
      setSelectedJobIds(preSelectedJobs.map(j => j.id));
    } else if (isOpen) {
      setSelectedJobIds([]);
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
      setSelectedJobIds(availableJobs.map(j => j.id));
    } else {
      setSelectedJobIds([]);
    }
  };

  const handleCreateBatch = async () => {
    try {
      const selectedJobs = jobs.filter(j => selectedJobIds.includes(j.id));
      await createBatch(selectedJobs, paperType, laminationType);
      onSuccess();
    } catch (error) {
      console.error('Error creating batch:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="px-4 py-2 rounded border" onClick={onClose}>Cancel</button>
          <button
            className="px-4 py-2 rounded bg-primary text-white disabled:opacity-50"
            onClick={handleCreateBatch}
            disabled={selectedJobIds.length === 0 || isCreatingBatch}
          >
            {isCreatingBatch ? "Creating Batch..." : "Create Batch"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostcardBatchCreateDialog;
