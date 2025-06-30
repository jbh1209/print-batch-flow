
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { isBusinessCardJobs, isSleeveJobs } from "./jobTypeUtils";
import { drawTableHeader } from "./tableHeaderRenderer";
import { renderFlyerJobTableRow, renderBaseJobTableRow } from "./tableRowRenderer";

export function drawCompactJobsTable(
  page: any, 
  jobs: Job[] | FlyerJob[] | BaseJob[], 
  tableY: number,
  colStarts: number[],
  helveticaFont: any,
  helveticaBold: any,
  helveticaItalic: any,
  margin: number,
  colWidths: number[],
  distribution: any = null
) {
  // Determine if these are sleeve jobs
  const isSleeve = isSleeveJobs(jobs);
  
  // Draw the table header using the updated function that removes the black line
  drawTableHeader(
    page,
    tableY,
    colStarts,
    helveticaBold,
    margin,
    colWidths,
    isBusinessCardJobs(jobs),
    isSleeve
  );
  
  // Draw the table rows in a more compact layout - reduced vertical spacing
  const rowY = tableY - 20; // Reduced from 25 to 20
  let currentY = rowY;
  
  jobs.forEach((job, index) => {
    // Render each job row based on type
    if ('pdf_url' in job && 'quantity' in job) {
      // This is a FlyerJob or BaseJob
      const rowHtml = 'file_name' in job ? 
        renderFlyerJobTableRow(job as FlyerJob) : 
        renderBaseJobTableRow(job as BaseJob);
      
      // Simple text rendering for PDF (HTML rendering would require additional parsing)
      page.drawText(
        `${job.name} | ${job.quantity} | ${new Date(job.due_date).toLocaleDateString()}`, 
        {
          x: colStarts[0],
          y: currentY,
          size: 10,
          font: helveticaFont,
        }
      );
      
      currentY -= 15;
    }
  });
  
  // Return the final Y position to help position elements that follow
  return currentY;
}
