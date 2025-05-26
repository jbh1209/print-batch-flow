
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { format } from "date-fns";
import { rgb } from "pdf-lib";
import { isBusinessCardJobs, isFlyerJobs, isSleeveJobs } from "./jobTypeUtils";

// Helper function to safely access job number regardless of job type
const getJobNumber = (job: Job | FlyerJob | BaseJob): string => {
  if ('job_number' in job && typeof job.job_number === 'string') {
    return job.job_number;
  } else {
    return (job.name && typeof job.name === 'string') ? job.name : 'Unknown Job';
  }
};

export function drawTableRows(
  page: any,
  jobs: Job[] | FlyerJob[] | BaseJob[],
  startY: number,
  colStarts: number[],
  font: any,
  distribution: any = null
) {
  let y = startY;
  
  // Limit display to top 5 jobs to ensure better fit
  const displayJobs = jobs.slice(0, 5);
  
  displayJobs.forEach((job, index) => {
    // Job number with more aggressive truncation for better fit
    const jobNumber = getJobNumber(job);
    const displayText = jobNumber.length > 12 ? jobNumber.substring(0, 9) + '...' : jobNumber;
    page.drawText(displayText, {
      x: colStarts[0],
      y,
      size: 8,
      font
    });
    
    // Due date with compact formatting
    const dueDate = job.due_date ? format(new Date(job.due_date), 'M/d') : 'N/A';
    page.drawText(dueDate, {
      x: colStarts[1],
      y,
      size: 8,
      font
    });
    
    // Quantity with proper alignment
    page.drawText(job.quantity.toString(), {
      x: colStarts[2],
      y,
      size: 8,
      font
    });
    
    // Fourth column based on job type
    if (isBusinessCardJobs([job])) {
      const businessCardJob = job as Job;
      const doubleSided = businessCardJob.double_sided ? 'Yes' : 'No';
      page.drawText(doubleSided, {
        x: colStarts[3],
        y,
        size: 8,
        font
      });
    } else if (isFlyerJobs([job])) {
      const flyerJob = job as FlyerJob;
      const sizeText = flyerJob.size || 'N/A';
      const displaySize = sizeText.length > 8 ? sizeText.substring(0, 6) + '..' : sizeText;
      page.drawText(displaySize, {
        x: colStarts[3],
        y,
        size: 8,
        font
      });
    } else if (isSleeveJobs([job])) {
      const sleeveJob = job as BaseJob;
      const stockType = 'stock_type' in sleeveJob ? sleeveJob.stock_type || 'Standard' : 'Standard';
      const displayStock = stockType.length > 8 ? stockType.substring(0, 6) + '..' : stockType;
      page.drawText(displayStock, {
        x: colStarts[3],
        y,
        size: 8,
        font
      });
    }
    
    // Reduced row spacing for better compactness
    y -= 14; // Increased slightly from 12 to 14 for better readability
  });
  
  // If there are more jobs than displayed, add compact note
  if (jobs.length > displayJobs.length) {
    page.drawText(`+ ${jobs.length - displayJobs.length} more`, {
      x: colStarts[0],
      y: y - 8,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });
    y -= 15; // Account for the additional text
  }
  
  // Return final Y position with proper buffer
  return y - 20;
}
