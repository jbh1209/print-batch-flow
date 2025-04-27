
import { PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { format } from "date-fns";
import { isBusinessCardJobs, isFlyerJobs, isSleeveJobs } from "./jobTypeUtils";

export function drawBatchInfo(
  page: PDFPage,
  batchName: string,
  jobs: Job[] | FlyerJob[] | BaseJob[],
  helveticaFont: any,
  helveticaBold: any,
  margin: number,
  sheetsRequired: number = 0
): void {
  // Draw batch header
  page.drawText(`Batch Overview: ${batchName}`, {
    x: margin,
    y: page.getHeight() - margin,
    size: 18,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(`Created: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, {
    x: margin,
    y: page.getHeight() - margin - 30,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Check if jobs array is not empty
  if (jobs.length === 0) {
    return;
  }
  
  // Check which type of job we're dealing with
  if (isBusinessCardJobs(jobs)) {
    // Business card specific info
    const businessCardJobs = jobs as Job[];
    
    // Draw lamination info with background
    const laminationType = businessCardJobs[0]?.lamination_type || 'none';
    const laminationText = `Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`;
    
    // Draw background box for lamination
    page.drawRectangle({
      x: margin - 5,
      y: page.getHeight() - margin - 75,
      width: 150,
      height: 30,
      color: rgb(0.102, 0.122, 0.173), // Dark purple background
    });
    
    // Draw lamination text in white
    page.drawText(laminationText, {
      x: margin,
      y: page.getHeight() - margin - 60,
      size: 12,
      font: helveticaBold,
      color: rgb(1, 1, 1) // White text
    });
    
    const totalCards = businessCardJobs.reduce((sum, job) => sum + job.quantity, 0);
    
    page.drawText(`Total Cards: ${totalCards}`, {
      x: margin,
      y: page.getHeight() - margin - 90,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    });
    
    // Calculate doubled sheets required
    const actualSheetsRequired = sheetsRequired > 0 ? sheetsRequired * 2 : Math.ceil(totalCards / 12);
    
    // Draw background box for sheets required
    page.drawRectangle({
      x: margin - 5,
      y: page.getHeight() - margin - 125,
      width: 200,
      height: 30,
      color: rgb(0.102, 0.122, 0.173), // Dark purple background
    });
    
    // Draw sheets required text in white
    page.drawText(`Sheets Required: ${actualSheetsRequired}`, {
      x: margin,
      y: page.getHeight() - margin - 110,
      size: 14,
      font: helveticaBold,
      color: rgb(1, 1, 1) // White text
    });
  } else if (isFlyerJobs(jobs)) {
    // Flyer specific info
    const flyerJobs = jobs as FlyerJob[] | BaseJob[];
    
    // Get paper information from the first job (assuming all jobs in a batch have the same paper)
    const paperWeight = flyerJobs[0]?.paper_weight || 'N/A';
    const paperType = flyerJobs[0]?.paper_type || 'N/A';
    
    // Draw paper info with background
    page.drawRectangle({
      x: margin - 5,
      y: page.getHeight() - margin - 75,
      width: 200,
      height: 30,
      color: rgb(0.102, 0.122, 0.173), // Dark background
    });
    
    page.drawText(`Paper: ${paperWeight} ${paperType}`, {
      x: margin,
      y: page.getHeight() - margin - 60,
      size: 12,
      font: helveticaBold,
      color: rgb(1, 1, 1) // White text
    });
    
    const totalPieces = flyerJobs.reduce((sum, job) => sum + job.quantity, 0);
    
    page.drawText(`Total Pieces: ${totalPieces}`, {
      x: margin,
      y: page.getHeight() - margin - 90,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    });
    
    // Draw sheets required info
    page.drawRectangle({
      x: margin - 5,
      y: page.getHeight() - margin - 125,
      width: 200,
      height: 30,
      color: rgb(0.102, 0.122, 0.173), // Dark background
    });
    
    // Estimate sheets required
    const estimatedSheets = sheetsRequired > 0 ? sheetsRequired : Math.ceil(totalPieces / 4);
    
    page.drawText(`Est. Sheets Required: ${estimatedSheets}`, {
      x: margin,
      y: page.getHeight() - margin - 110,
      size: 14,
      font: helveticaBold,
      color: rgb(1, 1, 1) // White text
    });
  } else if (isSleeveJobs(jobs)) {
    // Sleeve specific info
    const sleeveJobs = jobs as BaseJob[];
    
    // Get stock type information from the first job (assuming all jobs in a batch have the same stock type)
    // Use optional chaining and nullish coalescing to handle potential undefined values
    const stockType = sleeveJobs[0]?.stock_type || 'Standard';
    
    // Draw stock type info with background
    page.drawRectangle({
      x: margin - 5,
      y: page.getHeight() - margin - 75,
      width: 150,
      height: 30,
      color: rgb(0.102, 0.122, 0.173), // Dark background
    });
    
    page.drawText(`Stock: ${stockType}`, {
      x: margin,
      y: page.getHeight() - margin - 60,
      size: 12,
      font: helveticaBold,
      color: rgb(1, 1, 1) // White text
    });
    
    const totalPieces = sleeveJobs.reduce((sum, job) => sum + job.quantity, 0);
    
    page.drawText(`Total Pieces: ${totalPieces}`, {
      x: margin,
      y: page.getHeight() - margin - 90,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    });
    
    // Draw sheets required info
    page.drawRectangle({
      x: margin - 5,
      y: page.getHeight() - margin - 125,
      width: 200,
      height: 30,
      color: rgb(0.102, 0.122, 0.173), // Dark background
    });
    
    // Estimate sheets required
    const estimatedSheets = sheetsRequired > 0 ? sheetsRequired : Math.ceil(totalPieces / 4);
    
    page.drawText(`Est. Sheets Required: ${estimatedSheets}`, {
      x: margin,
      y: page.getHeight() - margin - 110,
      size: 14,
      font: helveticaBold,
      color: rgb(1, 1, 1) // White text
    });
  }
}
