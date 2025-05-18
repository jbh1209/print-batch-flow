
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BaseJob } from '@/config/productTypes';

interface JobsSelectionPanelProps {
  availableJobs: BaseJob[];
  selectedJobIds: string[];
  handleSelectJob: (jobId: string, isSelected: boolean) => void;
  handleSelectAllJobs: (isSelected: boolean) => void;
}

export const JobsSelectionPanel: React.FC<JobsSelectionPanelProps> = ({
  availableJobs,
  selectedJobIds,
  handleSelectJob,
  handleSelectAllJobs
}) => {
  const allSelected = availableJobs.length > 0 && 
    availableJobs.every(job => selectedJobIds.includes(job.id));

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-lg font-medium">Select Jobs</h3>
        <p className="text-sm text-muted-foreground">
          Choose which jobs to include in this batch
        </p>
      </div>
      
      <ScrollArea className="h-[400px] border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={allSelected}
                  onCheckedChange={handleSelectAllJobs}
                />
              </TableHead>
              <TableHead>Job Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {availableJobs.map(job => (
              <TableRow key={job.id}>
                <TableCell>
                  <Checkbox 
                    checked={selectedJobIds.includes(job.id)}
                    onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                  />
                </TableCell>
                <TableCell>{job.name || job.job_number}</TableCell>
                <TableCell>{job.size}</TableCell>
                <TableCell>{job.quantity}</TableCell>
                <TableCell>
                  {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'Not set'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};
