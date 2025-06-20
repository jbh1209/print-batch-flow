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
    // Fallback to name if job_number is not available (shouldn't happen with proper types)
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
  
  // Limit display to top 8 jobs to prevent overlap with previews
  const displayJobs = jobs.slice(0, 8);
  
  displayJobs.forEach((job, index) => {
    // Job number (truncate if too long)
    const jobNumber = getJobNumber(job);
    const displayText = jobNumber.length > 18 ? jobNumber.substring(0, 15) + '...' : jobNumber;
    page.drawText(displayText, {
      x: colStarts[0],
      y,
      size: 9, // Smaller font
      font
    });
    
    // Due date (formatted)
    const dueDate = job.due_date ? format(new Date(job.due_date), 'MMM d') : 'N/A';
    page.drawText(dueDate, {
      x: colStarts[1],
      y,
      size: 9, // Smaller font
      font
    });
    
    // Quantity
    page.drawText(job.quantity.toString(), {
      x: colStarts[2],
      y,
      size: 9, // Smaller font
      font
    });
    
    // Stock Type or Size or Double-sided based on job type
    if (isBusinessCardJobs([job])) {
      const businessCardJob = job as Job;
      const doubleSided = businessCardJob.double_sided ? 'Yes' : 'No';
      page.drawText(doubleSided, {
        x: colStarts[3],
        y,
        size: 9, // Smaller font
        font
      });
    } else if (isFlyerJobs([job])) {
      const flyerJob = job as FlyerJob;
      page.drawText(flyerJob.size || 'N/A', {
        x: colStarts[3],
        y,
        size: 9, // Smaller font
        font
      });
    } else if (isSleeveJobs([job])) {
      const sleeveJob = job as BaseJob;
      const stockType = 'stock_type' in sleeveJob ? sleeveJob.stock_type : 'Standard';
      page.drawText(stockType || 'Standard', {
        x: colStarts[3],
        y,
        size: 9, // Smaller font
        font
      });
    }
    
    // Update y for next row - reduced vertical spacing
    y -= 15; // Reduced from 20 to 15
  });
  
  // If there are more jobs than we displayed, add a note
  if (jobs.length > displayJobs.length) {
    page.drawText(`+ ${jobs.length - displayJobs.length} more jobs`, {
      x: colStarts[0],
      y: y - 5,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });
  }
  
  // Return the final Y position to help position elements that follow the table
  return y - 20; // Extra padding below the table
}
