
import { PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";

// Function to draw a single job row
export function drawJobRow(
  page: PDFPage,
  job: Job,
  rowY: number,
  colStarts: number[],
  helveticaFont: any,
  margin: number,
  colWidths: number[],
  rowHeight: number,
  index: number
): PDFPage {
  // Truncate job name if too long
  let jobName = job.name;
  if (jobName.length > 30) {
    jobName = jobName.substring(0, 27) + "...";
  }
  
  page.drawText(jobName, {
    x: colStarts[0],
    y: rowY,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(format(new Date(job.due_date), 'yyyy-MM-dd'), {
    x: colStarts[1],
    y: rowY,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(job.quantity.toString(), {
    x: colStarts[2],
    y: rowY,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(job.double_sided ? "Yes" : "No", {
    x: colStarts[3],
    y: rowY,
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Add light gray row background for every other row
  if (index % 2 === 1) {
    page.drawRectangle({
      x: margin,
      y: rowY - 5,
      width: colWidths.reduce((a, b) => a + b, 0),
      height: rowHeight,
      color: rgb(0.95, 0.95, 0.95),
      opacity: 0.5,
      borderWidth: 0
    });
  }
  
  return page;
}
