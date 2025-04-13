
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import JobsTable, { Job } from "@/components/business-cards/JobsTable";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface JobsTableContainerProps {
  jobs: Job[];
  isLoading: boolean;
  onRefresh: () => void;
  selectedJobs: string[];
  onSelectJob: (jobId: string, isSelected: boolean) => void;
  onSelectAllJobs: (isSelected: boolean) => void;
}

const JobsTableContainer = ({ 
  jobs, 
  isLoading, 
  onRefresh,
  selectedJobs,
  onSelectJob,
  onSelectAllJobs 
}: JobsTableContainerProps) => {
  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Select</TableHead>
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
              onRefresh={onRefresh}
              selectedJobs={selectedJobs}
              onSelectJob={onSelectJob}
              onSelectAllJobs={onSelectAllJobs}
            />
          </TableBody>
        </Table>
      </div>
      
      {jobs.length > 0 && (
        <div className="p-4 border-t">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>1</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  );
};

export default JobsTableContainer;
