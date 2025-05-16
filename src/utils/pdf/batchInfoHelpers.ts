
import { PDFPage } from "pdf-lib";
import { Job, LaminationType } from "@/components/batches/types/BatchTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { isBusinessCardJobs, isFlyerJobs, isSleeveJobs } from "./jobTypeUtils";
import { drawBatchHeader } from "./batch-info/batchHeaderRenderer";
import { drawBusinessCardInfo } from "./batch-info/businessCardInfoRenderer";
import { drawFlyerInfo } from "./batch-info/flyerInfoRenderer";
import { drawSleeveInfo } from "./batch-info/sleeveInfoRenderer";

// Function to convert and normalize job types for internal use
function normalizeJobsToRequiredFormat<T extends BaseJob>(jobs: T[]): Job[] {
  return jobs.map(job => ({
    id: job.id,
    name: job.name || '',
    quantity: job.quantity,
    status: job.status,
    pdf_url: job.pdf_url,
    job_number: job.job_number || `JOB-${job.id.substring(0, 6)}`,
    file_name: job.file_name || `job-${job.id.substring(0, 6)}.pdf`,
    uploaded_at: job.uploaded_at || job.created_at || new Date().toISOString(),
    lamination_type: (job.lamination_type as LaminationType) || "none",
    size: typeof job.size === 'string' ? job.size : job.size ? String(job.size) : undefined,
    double_sided: 'double_sided' in job ? job.double_sided : undefined
  }));
}

export function drawBatchInfo(
  page: PDFPage,
  batchName: string,
  jobs: Job[] | FlyerJob[] | BaseJob[],
  helveticaFont: any,
  helveticaBold: any,
  margin: number,
  sheetsRequired: number = 0
): void {
  // Normalize jobs to required format for consistent handling
  const normalizedJobs = normalizeJobsToRequiredFormat(jobs);

  // Draw the batch header
  drawBatchHeader(page, batchName, helveticaBold, helveticaFont, margin);
  
  // Check if jobs array is not empty
  if (normalizedJobs.length === 0) {
    return;
  }
  
  // Draw specific info based on job type
  if (isBusinessCardJobs(normalizedJobs)) {
    drawBusinessCardInfo(page, normalizedJobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isFlyerJobs(jobs)) {
    drawFlyerInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isSleeveJobs(jobs)) {
    drawSleeveInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  }
}
