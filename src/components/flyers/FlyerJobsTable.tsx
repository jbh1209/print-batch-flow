
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { FileText, Eye, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFlyerJobs } from "@/hooks/useFlyerJobs";

export const FlyerJobsTable = () => {
  const { jobs, isLoading } = useFlyerJobs();
  const navigate = useNavigate();

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

  return (
    <div className="bg-white rounded-lg shadow">
      <Table>
        <TableHeader>
          <TableRow>
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
          {jobs.map((job) => (
            <TableRow key={job.id}>
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
                <Badge
                  variant={job.status === "queued" ? "outline" : "default"}
                  className={`${
                    job.status === "queued" 
                      ? "bg-blue-50 text-blue-700 border-blue-200" 
                      : job.status === "in_batch" 
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }`}
                >
                  {job.status === "queued" 
                    ? "Queued" 
                    : job.status === "in_batch" 
                    ? "In Batch"
                    : "Completed"}
                </Badge>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
