import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, FileDown, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import DueDateIndicator from "./DueDateIndicator";

// Make JobStatus more flexible to handle database string values
export type JobStatus = "queued" | "batched" | "completed" | "cancelled" | string;

export type LaminationType = "gloss" | "matt" | "soft_touch" | "none";

export interface Job {
  id: string;
  name: string;
  file_name: string;
  quantity: number;
  lamination_type: LaminationType;
  due_date: string;
  uploaded_at: string;
  status: JobStatus; // Now accepts any string
  pdf_url: string;
  double_sided?: boolean;
  job_number?: string;
  updated_at?: string;
  user_id?: string;
  paper_type?: string;
}

interface JobsTableProps {
  jobs: Job[];
  selectedJobs: string[];
  onJobSelect: (jobId: string, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  onDeleteJob: (jobId: string) => void;
  isLoading?: boolean;
}

const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  selectedJobs,
  onJobSelect,
  onSelectAll,
  onDeleteJob,
  isLoading = false
}) => {
  const allSelected = jobs.length > 0 && selectedJobs.length === jobs.length;
  const someSelected = selectedJobs.length > 0;

  const handlePdfView = (pdfUrl: string) => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const getStatusBadge = (status: JobStatus) => {
    const statusColors = {
      queued: "bg-yellow-100 text-yellow-800",
      batched: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800"
    };

    const color = statusColors[status as keyof typeof statusColors] || "bg-gray-100 text-gray-800";
    
    return (
      <Badge variant="outline" className={color}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 p-4">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onSelectAll(!!checked)}
                  aria-label="Select all jobs"
                />
              </th>
              <th className="text-left p-4 font-medium text-gray-700">Job Details</th>
              <th className="text-left p-4 font-medium text-gray-700">Specifications</th>
              <th className="text-left p-4 font-medium text-gray-700">Quantity</th>
              <th className="text-left p-4 font-medium text-gray-700">Due Date</th>
              <th className="text-left p-4 font-medium text-gray-700">Status</th>
              <th className="text-left p-4 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t hover:bg-gray-50">
                <td className="p-4">
                  <Checkbox
                    checked={selectedJobs.includes(job.id)}
                    onCheckedChange={(checked) => onJobSelect(job.id, !!checked)}
                    aria-label={`Select ${job.name}`}
                  />
                </td>
                <td className="p-4">
                  <div>
                    <p className="font-medium text-gray-900">{job.name}</p>
                    <p className="text-sm text-gray-500">{job.file_name}</p>
                    {job.job_number && (
                      <p className="text-xs text-gray-400">#{job.job_number}</p>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm">
                    <p className="text-gray-900">{job.lamination_type}</p>
                    {job.double_sided && (
                      <Badge variant="secondary" className="text-xs mt-1">Double-sided</Badge>
                    )}
                    {job.paper_type && (
                      <p className="text-xs text-gray-500 mt-1">{job.paper_type}</p>
                    )}
                  </div>
                </td>
                <td className="p-4 text-gray-900">{job.quantity.toLocaleString()}</td>
                <td className="p-4">
                  <DueDateIndicator dueDate={job.due_date} />
                </td>
                <td className="p-4">
                  {getStatusBadge(job.status)}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePdfView(job.pdf_url)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteJob(job.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {jobs.length === 0 && !isLoading && (
        <div className="p-8 text-center text-gray-500">
          No business card jobs found.
        </div>
      )}
    </div>
  );
};

export default JobsTable;
