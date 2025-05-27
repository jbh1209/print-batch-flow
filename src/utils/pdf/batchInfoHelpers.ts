
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
  console.log("=== BATCH INFO HELPERS START ===");
  console.log("Batch name:", batchName);
  console.log("Jobs length:", jobs.length);
  console.log("Sheets required parameter received:", sheetsRequired);
  console.log("Type of sheetsRequired:", typeof sheetsRequired);
  console.log("sheetsRequired analysis in batchInfoHelpers:");
  console.log("  - Raw value:", sheetsRequired);
  console.log("  - Is undefined:", sheetsRequired === undefined);
  console.log("  - Is null:", sheetsRequired === null);
  console.log("  - Is 0:", sheetsRequired === 0);
  console.log("  - Is truthy:", !!sheetsRequired);
  
  // Draw the batch header
  drawBatchHeader(page, batchName, helveticaBold, helveticaFont, margin);
  
  // Check if jobs array is not empty
  if (jobs.length === 0) {
    console.log("No jobs to process, returning early");
    return;
  }
  
  // Draw specific info based on job type
  if (isBusinessCardJobs(jobs)) {
    console.log("=== CALLING BUSINESS CARD INFO RENDERER ===");
    console.log("Passing sheetsRequired to drawBusinessCardInfo:", sheetsRequired);
    drawBusinessCardInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isFlyerJobs(jobs)) {
    console.log("=== CALLING FLYER INFO RENDERER ===");
    console.log("Passing sheetsRequired to drawFlyerInfo:", sheetsRequired);
    drawFlyerInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  } else if (isSleeveJobs(jobs)) {
    console.log("=== CALLING SLEEVE INFO RENDERER ===");
    console.log("Passing sheetsRequired to drawSleeveInfo:", sheetsRequired);
    drawSleeveInfo(page, jobs, margin, helveticaBold, helveticaFont, sheetsRequired);
  }
  
  console.log("=== BATCH INFO HELPERS COMPLETE ===");
}
