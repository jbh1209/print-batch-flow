
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
  
  // Draw the table header
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
  
  // Draw the table rows
  const rowY = tableY - 25;
  drawTableRows(
    page,
    jobs,
    rowY,
    colStarts,
    helveticaFont,
    distribution
  );
}
