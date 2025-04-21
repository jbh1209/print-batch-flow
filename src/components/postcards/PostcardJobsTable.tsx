import { useState } from "react";
import { usePostcardJobs } from "@/hooks/usePostcardJobs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PostcardBatchCreateDialog from "./PostcardBatchCreateDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PostcardJob } from "@/components/batches/types/PostcardTypes";
import { toast } from "sonner";

// Example status types: "queued" | "batched" | "completed"
// Adjust as needed by actual PostcardJob status values
const STATUS_TYPES = ["all", "queued", "batched", "completed"];

const PostcardJobsTable = () => {
  const navigate = useNavigate();
  const { jobs, isLoading, error, fetchJobs } = usePostcardJobs();
  const [selectedJobs, setSelectedJobs] = useState<PostcardJob[]>([]);
  const [filterView, setFilterView] = useState<"all" | "queued" | "batched" | "completed">("all");
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);

  const filteredJobs = filterView === 'all' ? jobs : jobs.filter(job => job.status === filterView);
  const availableJobs = jobs.filter(job => job.status === "queued");

  // Counts for status tabs
  const filterCounts = {
    all: jobs.length,
    queued: jobs.filter(job => job.status === "queued").length,
    batched: jobs.filter(job => job.status === "batched").length,
    completed: jobs.filter(job => job.status === "completed").length,
  };

  // Selection logic
  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      const job = jobs.find(j => j.id === jobId && j.status === "queued");
      if (job) setSelectedJobs([...selectedJobs, job]);
    } else {
      setSelectedJobs(selectedJobs.filter(j => j.id !== jobId));
    }
  };
  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) setSelectedJobs(availableJobs);
    else setSelectedJobs([]);
  };

  // Create batch
  const handleOpenBatchDialog = () => setIsBatchDialogOpen(true);
  const handleBatchDialogClose = () => setIsBatchDialogOpen(false);
  const handleBatchSuccess = () => {
    setIsBatchDialogOpen(false);
    setSelectedJobs([]);
    fetchJobs();
    toast.success("Batch created successfully");
  };

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading...</div>;
  if (error) return <div className="p-10 text-center text-red-500">{error}</div>;
  if (!jobs.length) return (
    <div className="p-10 text-center text-muted-foreground">
      No jobs found.<br />
      <Button className="mt-4" onClick={() => navigate("/batches/postcards/jobs/new")}>
        <Plus size={16} className="mr-1" /> Add New Job
      </Button>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border shadow">
      <div className="flex gap-4 border-b px-6 pt-4">
        {STATUS_TYPES.map(status => (
          <button
            key={status}
            className={`px-3 py-2 rounded-t ${filterView === status ? 'bg-primary text-white' : ''}`}
            onClick={() => setFilterView(status as any)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} ({filterCounts[status as keyof typeof filterCounts]})
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center px-6 py-3 border-b gap-2">
        <div className="text-sm text-muted-foreground">
          {selectedJobs.length} of {availableJobs.length} jobs selected
        </div>
        <Button
          disabled={selectedJobs.length === 0}
          onClick={handleOpenBatchDialog}
        >
          Create Batch
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={selectedJobs.length === availableJobs.length && availableJobs.length > 0}
                onChange={e => handleSelectAll(e.target.checked)}
                disabled={availableJobs.length === 0}
              />
            </TableHead>
            <TableHead>Client Name</TableHead>
            <TableHead>Job Number</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Paper</TableHead>
            <TableHead>Lamination</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredJobs.map(job => (
            <TableRow key={job.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={!!selectedJobs.find(j => j.id === job.id)}
                  disabled={job.status !== "queued"}
                  onChange={e => handleSelectJob(job.id, e.target.checked)}
                  aria-label="Select job"
                />
              </TableCell>
              <TableCell className="font-medium">{job.name}</TableCell>
              <TableCell>{job.job_number}</TableCell>
              <TableCell>{job.size}</TableCell>
              <TableCell>{job.paper_type}</TableCell>
              <TableCell>{job.lamination_type}</TableCell>
              <TableCell>{job.quantity}</TableCell>
              <TableCell>{job.due_date && new Date(job.due_date).toLocaleDateString()}</TableCell>
              <TableCell>{job.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <PostcardBatchCreateDialog
        isOpen={isBatchDialogOpen}
        onClose={handleBatchDialogClose}
        onSuccess={handleBatchSuccess}
        preSelectedJobs={selectedJobs}
      />
    </div>
  );
};

export default PostcardJobsTable;
