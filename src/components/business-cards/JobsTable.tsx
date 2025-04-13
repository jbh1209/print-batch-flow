
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import { format } from "date-fns";
import JobStatusBadge from "@/components/JobStatusBadge";
import { useToast } from "@/hooks/use-toast";

export type JobStatus = "queued" | "batched" | "completed" | "cancelled";
export type LaminationType = "gloss" | "matt" | "soft_touch" | "none";

export interface Job {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  lamination_type: LaminationType;
  due_date: string;
  uploaded_at: string;
  status: JobStatus;
  pdf_url: string;
}

interface JobsTableProps {
  jobs: Job[];
  isLoading: boolean;
  handleViewJob: (jobId: string) => void;
}

const JobsTable = ({ jobs, isLoading, handleViewJob }: JobsTableProps) => {
  const { toast } = useToast();
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="h-24 text-center">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2">Loading...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (jobs.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={9} className="h-64 text-center">
          <div className="flex flex-col items-center justify-center text-gray-500">
            <div className="bg-gray-100 rounded-full p-3 mb-3">
              <UploadCloud size={24} />
            </div>
            <h3 className="font-medium mb-1">No jobs found</h3>
            <p className="text-sm mb-4">There are no business card jobs available.</p>
            <p className="text-sm text-gray-400 max-w-lg">
              You can add a new job using the "Add New Job" button. 
              If you're experiencing issues, please check if storage and 
              database permissions are set up correctly.
            </p>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {jobs.map((job) => (
        <TableRow key={job.id}>
          <TableCell><input type="checkbox" className="rounded border-gray-300" /></TableCell>
          <TableCell>{job.name}</TableCell>
          <TableCell>
            <span 
              className="text-blue-600 hover:underline cursor-pointer" 
              onClick={() => {
                if (job.pdf_url) {
                  window.open(job.pdf_url, '_blank');
                } else {
                  toast({
                    title: "File unavailable",
                    description: "The PDF file is not available for viewing.",
                    variant: "destructive",
                  });
                }
              }}
            >
              {job.file_name}
            </span>
          </TableCell>
          <TableCell>{job.quantity}</TableCell>
          <TableCell>
            {job.lamination_type === 'none' ? 'None' : 
             job.lamination_type.charAt(0).toUpperCase() + job.lamination_type.slice(1)}
          </TableCell>
          <TableCell>{formatDate(job.due_date)}</TableCell>
          <TableCell>{formatDate(job.uploaded_at)}</TableCell>
          <TableCell><JobStatusBadge status={job.status} /></TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm" onClick={() => handleViewJob(job.id)}>View</Button>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
};

export default JobsTable;
