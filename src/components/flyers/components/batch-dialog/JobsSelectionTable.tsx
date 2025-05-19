
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { EmptyJobsMessage } from "../EmptyJobsMessage";

interface JobsSelectionTableProps {
  availableJobs: FlyerJob[];
  selectedJobIds: string[];
  handleSelectJob: (jobId: string, isSelected: boolean) => void;
  handleSelectAllJobs: (isSelected: boolean) => void;
}

export const JobsSelectionTable = ({
  availableJobs,
  selectedJobIds,
  handleSelectJob,
  handleSelectAllJobs,
}: JobsSelectionTableProps) => {
  return (
    <div className="max-h-[400px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox 
                checked={selectedJobIds.length === availableJobs.length && availableJobs.length > 0} 
                onCheckedChange={handleSelectAllJobs}
                disabled={availableJobs.length === 0}
              />
            </TableHead>
            <TableHead>Job Name</TableHead>
            <TableHead>Job #</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Paper</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {availableJobs.length === 0 ? (
            <EmptyJobsMessage colSpan={7} message="No jobs available for batching" />
          ) : (
            availableJobs.map((job) => {
              const isSelected = selectedJobIds.includes(job.id);
              
              return (
                <TableRow key={job.id} className={isSelected ? "bg-primary/5" : undefined}>
                  <TableCell>
                    <Checkbox 
                      checked={isSelected} 
                      onCheckedChange={(checked) => handleSelectJob(job.id, checked === true)}
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
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
