
import { TableBody } from "@/components/ui/table";
import { ProductPageJob } from "../types/ProductPageTypes";
import { ProductPageJobRow } from "./ProductPageJobRow";

interface ProductPageJobsBodyProps {
  jobs: ProductPageJob[];
  selectedJobs: ProductPageJob[];
  handleSelectJob: (jobId: string, isSelected: boolean) => void;
}

export function ProductPageJobsBody({ 
  jobs, 
  selectedJobs,
  handleSelectJob 
}: ProductPageJobsBodyProps) {
  return (
    <TableBody>
      {jobs.map((job) => (
        <ProductPageJobRow
          key={job.id}
          job={job}
          isSelected={selectedJobs.some((selectedJob) => selectedJob.id === job.id)}
          onSelect={handleSelectJob}
        />
      ))}
    </TableBody>
  );
}
