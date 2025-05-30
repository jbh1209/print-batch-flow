
import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { JobTableRow } from "./JobTableRow";

interface JobsTableProps {
  jobs: any[];
  selectedJobs: any[];
  onSelectJob: (job: any, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onJobUpdate: () => void;
  onEditJob: (job: any) => void;
  onSyncJob: (job: any) => void;
  onCategoryAssign: (job: any) => void;
  onWorkflowInit: (job: any) => void;
  onDeleteJob: (jobId: string) => void;
}

export const JobsTable: React.FC<JobsTableProps> = ({
  jobs,
  selectedJobs,
  onSelectJob,
  onSelectAll,
  onJobUpdate,
  onEditJob,
  onSyncJob,
  onCategoryAssign,
  onWorkflowInit,
  onDeleteJob
}) => {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedJobs.length === jobs.length && jobs.length > 0}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead>WO Number</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Current Stage</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>QR Code</TableHead>
            <TableHead className="w-32">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <JobTableRow
              key={job.id}
              job={job}
              isSelected={selectedJobs.some(j => j.id === job.id)}
              onSelectJob={onSelectJob}
              onJobUpdate={onJobUpdate}
              onEditJob={onEditJob}
              onSyncJob={onSyncJob}
              onCategoryAssign={onCategoryAssign}
              onWorkflowInit={onWorkflowInit}
              onDeleteJob={onDeleteJob}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
