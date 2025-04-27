import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { format } from "date-fns";
import { rgb } from "pdf-lib";
import { isBusinessCardJobs } from "./jobTypeUtils";

export function drawTableRows(
  page: any,
  jobs: Job[] | FlyerJob[],
  startY: number,
  colStarts: number[],
  font: any,
  distribution: any = null
) {
  let y = startY;
  
  jobs.forEach((job, index) => {
    // Job name (truncate if too long)
    const name = job.name.length > 18 ? job.name.substring(0, 15) + '...' : job.name;
    page.drawText(name, {
      x: colStarts[0],
      y,
      size: 10,
      font
    });
    
    // Due date (formatted)
    const dueDate = job.due_date ? format(new Date(job.due_date), 'MMM d') : 'N/A';
    page.drawText(dueDate, {
      x: colStarts[1],
      y,
      size: 10,
      font
    });
    
    // Quantity
    page.drawText(job.quantity.toString(), {
      x: colStarts[2],
      y,
      size: 10,
      font
    });
    
    // Stock Type or Size or Double-sided based on job type
    if (isBusinessCardJobs([job])) {
      const businessCardJob = job as Job;
      const doubleSided = businessCardJob.double_sided ? 'Yes' : 'No';
      page.drawText(doubleSided, {
        x: colStarts[3],
        y,
        size: 10,
        font
      });
    } else if (isFlyerJobs([job])) {
      const flyerJob = job as FlyerJob;
      page.drawText(flyerJob.size || 'N/A', {
        x: colStarts[3],
        y,
        size: 10,
        font
      });
    } else if (isSleeveJobs([job])) {
      const sleeveJob = job as BaseJob;
      page.drawText(sleeveJob.stock_type || 'Standard', {
        x: colStarts[3],
        y,
        size: 10,
        font
      });
    }
    
    // Update y for next row
    y -= 20;
  });
}
