
import { PDFPage } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
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
  console.log("Drawing batch info for batch:", batchName);
  console.log("Jobs received:", jobs.length);
  console.log("Sheets required:", sheetsRequired);
  
  // Draw the batch header
  drawBatchHeader(page, batchName, helveticaBold, helveticaFont, margin);
  
  // Check if jobs array is not empty
  if (jobs.length === 0) {
    console.log("No jobs to process");
    return;
  }
  
  // Draw specific info based on job type
  if (isBusinessCardJobs(jobs)) {
    console.log("Drawing business card info");
    drawBusinessCardInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isFlyerJobs(jobs)) {
    console.log("Drawing flyer info");
    drawFlyerInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isSleeveJobs(jobs)) {
    console.log("Drawing sleeve info");
    drawSleeveInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else {
    console.log("Unknown job type, jobs properties:", jobs[0] ? Object.keys(jobs[0]) : 'no jobs');
  }
}
