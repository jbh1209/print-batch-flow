
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Eye, FilePenLine, MoreHorizontal, Trash2, FileUp } from "lucide-react";
import JobStatusBadge from '@/components/JobStatusBadge';
import { format } from 'date-fns';
import { BaseJob, ProductConfig } from '@/config/productTypes';

interface GenericJobsTableProps {
  jobs: BaseJob[];
  isLoading: boolean;
  error: string | null;
  deleteJob: (id: string) => Promise<boolean>;
  fetchJobs: () => Promise<void>;
  createBatch: (jobs: BaseJob[], properties: any) => Promise<any>;
  isCreatingBatch: boolean;
  fixBatchedJobsWithoutBatch: () => Promise<void>;
  isFixingBatchedJobs?: boolean;
  config: ProductConfig;
}

const GenericJobsTable = ({
  jobs,
  isLoading,
  error,
  deleteJob,
  fetchJobs,
  createBatch,
  isCreatingBatch,
  fixBatchedJobsWithoutBatch,
  isFixingBatchedJobs,
  config
}: GenericJobsTableProps) => {
  const navigate = useNavigate();
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<BaseJob[]>([]);
  
  // Filter to only show queued jobs that can be selected for batching
  const queuedJobs = jobs.filter(job => job.status === 'queued');
  
  // Update selected jobs when selection changes
  useEffect(() => {
    const selected = jobs.filter(job => selectedJobIds.includes(job.id));
    setSelectedJobs(selected);
  }, [selectedJobIds, jobs]);
  
  const handleViewJob = (id: string) => {
    navigate(config.routes.jobDetailPath(id));
  };
  
  const handleEditJob = (id: string) => {
    navigate(config.routes.jobEditPath(id));
  };
  
  const confirmDelete = async () => {
    if (!jobToDelete) return;
    
    try {
      setIsDeleting(true);
      await deleteJob(jobToDelete);
    } finally {
      setIsDeleting(false);
      setJobToDelete(null);
    }
  };
  
  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobIds((prev) => [...prev, jobId]);
    } else {
      setSelectedJobIds((prev) => prev.filter((id) => id !== jobId));
    }
  };
  
  const handleSelectAllJobs = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(queuedJobs.map((job) => job.id));
    } else {
      setSelectedJobIds([]);
    }
  };
  
  const handleBatchSelected = () => {
    const selectedJobs = jobs.filter(job => selectedJobIds.includes(job.id));
    createBatch(selectedJobs, {});
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <p>Loading jobs...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
        <p>Error: {error}</p>
      </div>
    );
  }
  
  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-medium">No jobs found</h3>
        <p className="text-gray-500 mt-2">Create a new job to get started.</p>
      </div>
    );
  }
  
  return (
    <div>
      {queuedJobs.length > 0 && (
        <div className="mb-4 flex justify-between items-center">
          <div className="flex items-center">
            <Checkbox 
              checked={selectedJobIds.length === queuedJobs.length && queuedJobs.length > 0}
              onCheckedChange={handleSelectAllJobs}
            />
            <span className="ml-2">
              {selectedJobIds.length} of {queuedJobs.length} jobs selected
            </span>
          </div>
          
          {selectedJobIds.length > 0 && (
            <Button onClick={handleBatchSelected}>
              <FileUp className="mr-2 h-4 w-4" />
              Batch Selected ({selectedJobIds.length})
            </Button>
          )}
        </div>
      )}
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Job Number</TableHead>
              {config.hasSize && <TableHead>Size</TableHead>}
              {config.hasPaperType && <TableHead>Paper Type</TableHead>}
              <TableHead>Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  {job.status === 'queued' && (
                    <Checkbox 
                      checked={selectedJobIds.includes(job.id)}
                      onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                    />
                  )}
                </TableCell>
                <TableCell>{job.name}</TableCell>
                <TableCell>{job.job_number}</TableCell>
                {config.hasSize && <TableCell>{job.size || 'N/A'}</TableCell>}
                {config.hasPaperType && <TableCell>{job.paper_type || 'N/A'}</TableCell>}
                <TableCell>{job.quantity}</TableCell>
                <TableCell>
                  <JobStatusBadge status={job.status} />
                </TableCell>
                <TableCell>{format(new Date(job.due_date), 'MMM dd, yyyy')}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewJob(job.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditJob(job.id)}>
                        <FilePenLine className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setJobToDelete(job.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!jobToDelete} onOpenChange={(open) => !open && setJobToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              job and all its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GenericJobsTable;
