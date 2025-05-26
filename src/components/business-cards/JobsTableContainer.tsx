
import { Table, TableHeader, TableBody, TableHead, TableRow } from "@/components/ui/table";
import JobsTable, { Job } from "./JobsTable";

interface JobsTableContainerProps {
  jobs: Job[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  selectedJobs: string[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
  onSelectAllJobs: (isSelected: boolean) => void;
}

const JobsTableContainer = ({
  jobs,
  isLoading,
  error,
  onRefresh,
  selectedJobs,
  onSelectJob,
  onSelectAllJobs
}: JobsTableContainerProps) => {
  return (
    <div className="border-t">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Select</span>
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Lamination</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <JobsTable
            jobs={jobs}
            isLoading={isLoading}
            error={error}
            onRefresh={onRefresh}
            selectedJobs={selectedJobs}
            onSelectJob={onSelectJob}
            onSelectAllJobs={onSelectAllJobs}
          />
        </TableBody>
      </Table>
    </div>
  );
};

export default JobsTableContainer;
