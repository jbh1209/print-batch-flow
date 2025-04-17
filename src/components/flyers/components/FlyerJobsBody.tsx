
import { TableBody } from "@/components/ui/table";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { FlyerJobRow } from "./FlyerJobRow";
import { EmptyJobsMessage } from "./EmptyJobsMessage";

interface FlyerJobsBodyProps {
  jobs: FlyerJob[];
  selectedJobs: FlyerJob[];
  handleSelectJob: (jobId: string, isSelected: boolean) => void;
}

export const FlyerJobsBody = ({ 
  jobs,
  selectedJobs,
  handleSelectJob
}: FlyerJobsBodyProps) => {
  return (
    <TableBody>
      {jobs.length === 0 ? (
        <EmptyJobsMessage colSpan={9} />
      ) : (
        jobs.map((job) => {
          const isSelected = selectedJobs.some(selectedJob => selectedJob.id === job.id);
          
          return (
            <FlyerJobRow 
              key={job.id} 
              job={job} 
              isSelected={isSelected} 
              onSelectJob={handleSelectJob} 
            />
          );
        })
      )}
    </TableBody>
  );
};
