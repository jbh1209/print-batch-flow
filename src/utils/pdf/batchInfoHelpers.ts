
import { PDFPage } from "pdf-lib";
import { Job } from "@/components/batches/types/BatchTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { isBusinessCardJobs, isFlyerJobs, isSleeveJobs } from "./jobTypeUtils";
import { drawBatchHeader } from "./batch-info/batchHeaderRenderer";
import { drawBusinessCardInfo } from "./batch-info/businessCardInfoRenderer";
import { drawFlyerInfo } from "./batch-info/flyerInfoRenderer";
import { drawSleeveInfo } from "./batch-info/sleeveInfoRenderer";

export function drawBatchInfo(
  page: PDFPage,
  batchName: string,
  jobs: Job[] | FlyerJob[] | BaseJob[],
  helveticaFont: any,
  helveticaBold: any,
  margin: number,
  sheetsRequired: number = 0
): void {
  // Draw the batch header
  drawBatchHeader(page, batchName, helveticaBold, helveticaFont, margin);
  
  // Check if jobs array is not empty
  if (jobs.length === 0) {
    return;
  }
  
  // Draw specific info based on job type
  if (isBusinessCardJobs(jobs)) {
    const typedJobs = jobs as Job[];
    drawBusinessCardInfo(page, typedJobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isFlyerJobs(jobs)) {
    drawFlyerInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isSleeveJobs(jobs)) {
    drawSleeveInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  }
}
