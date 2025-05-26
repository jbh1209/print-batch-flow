
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { BaseJob } from "@/config/productTypes";
import { isBusinessCardJobs, isSleeveJobs } from "./jobTypeUtils";
import { drawTableHeader } from "./tableHeaderRenderer";
import { drawTableRows } from "./tableRowRenderer";

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
  
  // Draw the table header with more compact styling
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
  
  // Draw the table rows in a more compact layout - further reduced vertical spacing
  const rowY = tableY - 15; // Reduced from 20 to 15
  const finalY = drawTableRows(
    page,
    jobs,
    rowY,
    colStarts,
    helveticaFont,
    distribution
  );
  
  // Return the final Y position to help position elements that follow
  return finalY;
}
