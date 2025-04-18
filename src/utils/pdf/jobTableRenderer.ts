
import { Job } from "@/components/business-cards/JobsTable";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";
import { isBusinessCardJobs } from "./jobTypeUtils";
import { drawTableHeader } from "./tableHeaderRenderer";
import { drawTableRows } from "./tableRowRenderer";

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
  // Draw the table header
  drawTableHeader(
    page,
    tableY,
    colStarts,
    helveticaBold,
    margin,
    colWidths,
    isBusinessCardJobs(jobs)
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
