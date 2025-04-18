
import { rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { isBusinessCardJobs } from "./jobTypeUtils";

export function drawTableRows(
  page: any,
  jobs: Job[] | FlyerJob[],
  rowY: number,
  colStarts: number[],
  helveticaFont: any,
  distribution: any = null
) {
  const rowHeight = 15; // Compact row height
  
  jobs.slice(0, 10).forEach((job, i) => {
    const jobY = rowY - (i * rowHeight);
    
    // Draw job name
    page.drawText(job.name.substring(0, 18) + (job.name.length > 18 ? '...' : ''), {
      x: colStarts[0],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Draw due date
    let dueDateFormatted = 'Unknown';
    if (job.due_date) {
      try {
        const parsedDate = new Date(job.due_date);
        dueDateFormatted = !isNaN(parsedDate.getTime()) 
          ? parsedDate.toLocaleDateString() 
          : 'Invalid Date';
      } catch {
        dueDateFormatted = 'Invalid Date';
      }
    }
    
    page.drawText(dueDateFormatted, {
      x: colStarts[1],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Draw quantity
    page.drawText(job.quantity.toString(), {
      x: colStarts[2],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Draw double-sided or size
    if (isBusinessCardJobs(jobs)) {
      page.drawText((job as Job).double_sided ? 'Yes' : 'No', {
        x: colStarts[3],
        y: jobY,
        size: 8,
        font: helveticaFont
      });
    } else {
      page.drawText((job as FlyerJob).size || 'N/A', {
        x: colStarts[3],
        y: jobY,
        size: 8,
        font: helveticaFont
      });
    }
    
    // Draw allocation
    if (distribution) {
      const jobDist = distribution.find((d: any) => d.job.id === job.id);
      if (jobDist) {
        page.drawText(`${jobDist.slotsNeeded} x ${jobDist.quantityPerSlot}`, {
          x: colStarts[4],
          y: jobY,
          size: 8,
          font: helveticaFont
        });
      }
    } else {
      page.drawText(`1 x ${job.quantity}`, {
        x: colStarts[4],
        y: jobY,
        size: 8,
        font: helveticaFont
      });
    }
  });
  
  // Show message for additional jobs
  if (jobs.length > 10) {
    page.drawText(`... and ${jobs.length - 10} more jobs`, {
      x: colStarts[0],
      y: rowY - (10 * rowHeight),
      size: 8,
      font: helveticaFont
    });
  }
}
