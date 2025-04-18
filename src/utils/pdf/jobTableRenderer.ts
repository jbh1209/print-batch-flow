
import { rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { isBusinessCardJobs } from "./jobTypeUtils";

export function drawCompactJobsTable(
  page: any, 
  jobs: Job[] | FlyerJob[], 
  tableY: number,
  colStarts: number[],
  helveticaFont: any,
  helveticaBold: any,
  helveticaItalic: any,
  margin: number,
  colWidths: number[],
  distribution: any = null
) {
  // Common header labels
  const headers = ["Job Name", "Due Date", "Quantity", isBusinessCardJobs(jobs) ? "Double-sided" : "Size", "Allocation"];
  
  // Draw table headers
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], {
      x: colStarts[i],
      y: tableY,
      size: 10,
      font: helveticaBold
    });
  }
  
  // Draw separator line
  page.drawLine({
    start: { x: margin, y: tableY - 10 },
    end: { x: margin + colWidths.reduce((a, b) => a + b, 0), y: tableY - 10 },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
  
  let rowY = tableY - 25;
  const rowHeight = 15; // Compact row height
  
  // Draw job rows
  for (let i = 0; i < jobs.length && i < 10; i++) {
    const job = jobs[i];
    const jobY = rowY - (i * rowHeight);
    
    // Draw job name (column 1)
    page.drawText(job.name.substring(0, 18) + (job.name.length > 18 ? '...' : ''), {
      x: colStarts[0],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Draw due date (column 2)
    let dueDateFormatted = 'Unknown';
    if (job.due_date) {
      if (Object.prototype.toString.call(job.due_date) === '[object Date]') {
        dueDateFormatted = (job.due_date as unknown as Date).toLocaleDateString();
      } else if (typeof job.due_date === 'string') {
        try {
          const dateString = job.due_date as string;
          const parsedDate = new Date(dateString);
          dueDateFormatted = !isNaN(parsedDate.getTime()) 
            ? parsedDate.toLocaleDateString() 
            : 'Invalid Date';
        } catch {
          dueDateFormatted = 'Invalid Date';
        }
      }
    }
    
    page.drawText(dueDateFormatted, {
      x: colStarts[1],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Draw quantity (column 3)
    page.drawText(job.quantity.toString(), {
      x: colStarts[2],
      y: jobY,
      size: 8,
      font: helveticaFont
    });
    
    // Column 4: Double-sided or Size depending on job type
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
    
    // Column 5: Allocation info
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
  }
  
  // If there are more jobs than we can show, indicate that
  if (jobs.length > 10) {
    page.drawText(`... and ${jobs.length - 10} more jobs`, {
      x: colStarts[0],
      y: rowY - (10 * rowHeight),
      size: 8,
      font: helveticaItalic
    });
  }
}
