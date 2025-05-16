
import { PDFPage } from "pdf-lib";
import { Job, LaminationType } from "@/components/batches/types/BatchTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { isBusinessCardJobs, isFlyerJobs, isSleeveJobs } from "./jobTypeUtils";
import { drawBatchHeader } from "./batch-info/batchHeaderRenderer";
import { drawBusinessCardInfo } from "./batch-info/businessCardInfoRenderer";
import { drawFlyerInfo } from "./batch-info/flyerInfoRenderer";
import { drawSleeveInfo } from "./batch-info/sleeveInfoRenderer";
import { convertToJobType } from "@/utils/typeAdapters";

// Function to convert and normalize job types for internal use
function normalizeJobsToRequiredFormat<T extends BaseJob>(jobs: T[]): Job[] {
  return jobs.map(job => convertToJobType(job));
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
  } else if (isFlyerJobs(jobs as FlyerJob[])) {
    drawFlyerInfo(page, jobs as FlyerJob[], margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isSleeveJobs(jobs as BaseJob[])) {
    drawSleeveInfo(page, jobs as BaseJob[], margin, helveticaBold, helveticaFont, sheetsRequired);
  }
}
