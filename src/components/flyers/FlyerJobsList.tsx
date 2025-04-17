
import { useState, useEffect } from "react";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import JobStatusBadge from "@/components/JobStatusBadge";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { Eye, Plus, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { FlyerJobsTableContainer } from "./FlyerJobsTableContainer";

interface FlyerJobsListProps {
  onSelectJobs: (jobs: FlyerJob[]) => void;
  onCreateBatchClick: () => void;
}

export const FlyerJobsList = ({ onSelectJobs, onCreateBatchClick }: FlyerJobsListProps) => {
  const navigate = useNavigate();
  const { jobs, isLoading, error, fetchJobs, fixBatchedJobsWithoutBatch, isFixingBatchedJobs } = useFlyerJobs();
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [filterView, setFilterView] = useState<"all" | "queued" | "batched" | "completed">("all");
  
  const filterCounts = {
    all: jobs.length,
    queued: jobs.filter(job => job.status === 'queued').length,
    batched: jobs.filter(job => job.status === 'batched').length,
    completed: jobs.filter(job => job.status === 'completed').length
  };

  // Filter jobs based on current view
  const filteredJobs = filterView === 'all' 
    ? jobs 
    : jobs.filter(job => job.status === filterView);

  // Get only jobs available for selection (queued status)
  const availableJobs = jobs.filter(job => job.status === 'queued');

  const handleSelectJob = (jobId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedJobs([...selectedJobs, jobId]);
    } else {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    }
  };

  const handleSelectAllJobs = (isSelected: boolean) => {
    if (isSelected) {
      // Only select jobs that are in "queued" status
      const selectableJobIds = availableJobs.map(job => job.id);
      setSelectedJobs(selectableJobIds);
    } else {
      setSelectedJobs([]);
    }
  };

  // Update parent component with selected job objects
  useEffect(() => {
    const selectedJobObjects = jobs.filter(job => selectedJobs.includes(job.id));
    onSelectJobs(selectedJobObjects);
  }, [selectedJobs, jobs]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8">
        <FileText className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No flyer jobs found</h3>
        <p className="text-gray-500 text-center mb-4">Get started by creating your first flyer job.</p>
        <Button onClick={() => navigate("/batches/flyers/jobs/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Job
        </Button>
      </div>
    );
  }

  // Count selectable jobs
  const selectableJobsCount = availableJobs.length;
  const batchButtonDisabled = selectedJobs.length === 0;

  return (
    <div className="bg-white rounded-lg border shadow">
      {/* Status filter tabs */}
      <div className="border-b">
        <div className="flex">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              filterView === 'all' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
            }`}
            onClick={() => setFilterView('all')}
          >
            All ({filterCounts.all})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              filterView === 'queued' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
            }`}
            onClick={() => setFilterView('queued')}
          >
            Queued ({filterCounts.queued})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              filterView === 'batched' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
            }`}
            onClick={() => setFilterView('batched')}
          >
            Batched ({filterCounts.batched})
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              filterView === 'completed' ? 'border-b-2 border-primary text-primary' : 'text-gray-500'
            }`}
            onClick={() => setFilterView('completed')}
          >
            Completed ({filterCounts.completed})
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex justify-between items-center p-4 border-b">
        <div className="text-sm text-muted-foreground">
          {selectedJobs.length} of {selectableJobsCount} jobs selected
        </div>
        <Button 
          onClick={onCreateBatchClick} 
          disabled={batchButtonDisabled}
        >
          Create Batch
        </Button>
      </div>

      {/* Fix Orphaned Jobs Button - only show if there are jobs stuck in batched state */}
      {filterCounts.batched > 0 && (
        <div className="border-t p-3 bg-amber-50 flex justify-between items-center">
          <div className="text-sm text-amber-800">
            <span className="font-medium">Note:</span> Some jobs may be stuck in "batched" status after a batch was deleted.
          </div>
          <Button 
            variant="outline" 
            size="sm"
            className="bg-white"
            onClick={fixBatchedJobsWithoutBatch}
            disabled={isFixingBatchedJobs}
          >
            {isFixingBatchedJobs ? (
              <>
                <div className="h-3 w-3 mr-2 rounded-full border-t-2 border-b-2 border-primary animate-spin"></div>
                Fixing...
              </>
            ) : (
              'Fix Orphaned Jobs'
            )}
          </Button>
        </div>
      )}

      {/* Jobs Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={selectedJobs.length === selectableJobsCount && selectableJobsCount > 0} 
                  onCheckedChange={handleSelectAllJobs}
                  disabled={selectableJobsCount === 0}
                />
              </TableHead>
              <TableHead>Job Name</TableHead>
              <TableHead>Job #</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Paper</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No jobs match the current filter
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => {
                const isSelected = selectedJobs.includes(job.id);
                const canSelect = job.status === "queued";
                
                return (
                  <TableRow key={job.id} className={isSelected ? "bg-primary/5" : undefined}>
                    <TableCell>
                      <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={(checked) => handleSelectJob(job.id, checked === true)}
                        disabled={!canSelect}
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
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        title="View Job"
                        onClick={() => navigate(`/batches/flyers/jobs/${job.id}`)}
                      >
                        <Eye size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
