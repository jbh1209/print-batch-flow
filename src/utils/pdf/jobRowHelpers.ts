
import { PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";
import { JobDistributionItem } from "../batchOptimizationHelpers";

// Helper function to safely access job number
const getJobNumber = (job: Job): string => {
  return 'job_number' in job ? job.job_number : job.name || 'Unknown Job';
};

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
  index: number,
  slotInfo?: { slots: number; quantityPerSlot: number }
): PDFPage {
  // Truncate job number if too long
  const jobNumber = getJobNumber(job);
  const displayText = jobNumber.length > 30 ? jobNumber.substring(0, 27) + "..." : jobNumber;
  
  page.drawText(displayText, {
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
  
  // Add slot allocation information if provided
  if (slotInfo) {
    page.drawText(`${slotInfo.slots} slots (${slotInfo.quantityPerSlot}/slot)`, {
      x: colStarts[4],
      y: rowY,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    });
  }
  
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

// Draw optimization information in the PDF
export function drawOptimizationInfo(
  page: PDFPage,
  distribution: JobDistributionItem[],
  startY: number,
  colStarts: number[],
  helveticaFont: any,
  helveticaBold: any,
  margin: number,
  colWidths: number[]
): number {
  let y = startY;
  
  // Draw section header
  page.drawText("Optimized Job Distribution", {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  y -= 25;
  
  // Draw header
  page.drawText("Job Number", {
    x: colStarts[0],
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Quantity", {
    x: colStarts[2],
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Slot Allocation", {
    x: colStarts[3] + 30,
    y,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  y -= 20;
  
  // Draw separator line
  page.drawLine({
    start: { x: margin, y: y + 10 },
    end: { x: margin + colWidths.reduce((a, b) => a + b, 0), y: y + 10 },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
  
  // Draw each job's optimization info
  const rowHeight = 20;
  distribution.forEach((item, i) => {
    // Use job_number instead of name
    const jobNumber = getJobNumber(item.job);
    const displayText = jobNumber.length > 30 ? jobNumber.substring(0, 27) + "..." : jobNumber;
    
    // Draw job number
    page.drawText(displayText, {
      x: colStarts[0],
      y,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    });
    
    // Draw quantity
    page.drawText(item.job.quantity.toString(), {
      x: colStarts[2],
      y,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    });
    
    // Draw slot allocation
    page.drawText(`${item.slotsNeeded} slots (${item.quantityPerSlot}/slot)`, {
      x: colStarts[3] + 30,
      y,
      size: 10,
      font: helveticaFont,
      color: rgb(0, 0, 0)
    });
    
    // Add light gray background for every other row
    if (i % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: y - 5,
        width: colWidths.reduce((a, b) => a + b, 0),
        height: rowHeight,
        color: rgb(0.95, 0.95, 0.95),
        opacity: 0.5,
        borderWidth: 0
      });
    }
    
    y -= rowHeight;
  });
  
  return y;
}
