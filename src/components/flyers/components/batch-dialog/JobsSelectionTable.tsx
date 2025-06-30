
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { useJobSpecificationDisplay } from "@/hooks/useJobSpecificationDisplay";
import { EmptyJobsMessage } from "../EmptyJobsMessage";

interface JobsSelectionTableProps {
  availableJobs: FlyerJob[];
  selectedJobIds: string[];
  handleSelectJob: (jobId: string, isSelected: boolean) => void;
  handleSelectAllJobs: (isSelected: boolean) => void;
}

const JobSpecificationDisplay = ({ job }: { job: FlyerJob }) => {
  const { getSize, getPaperType, getPaperWeight } = useJobSpecificationDisplay(job.id, 'flyer_jobs');
  
  return (
    <>
      <TableCell>{getSize()}</TableCell>
      <TableCell>
        {getPaperWeight()} {getPaperType()}
      </TableCell>
    </>
  );
};

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
                  <JobSpecificationDisplay job={job} />
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
