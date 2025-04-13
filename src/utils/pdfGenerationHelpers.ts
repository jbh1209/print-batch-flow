
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";

// Function to add a new A4 page
export function addNewPage(pdfDoc: PDFDocument): PDFPage {
  // A4 in points (72 points per inch)
  return pdfDoc.addPage([595.28, 841.89]);
}

// Function to draw batch information
export function drawBatchInfo(
  page: PDFPage,
  batchName: string,
  jobs: Job[],
  helveticaFont: any,
  helveticaBold: any,
  margin: number
): void {
  // Draw batch header
  page.drawText(`Batch Overview: ${batchName}`, {
    x: margin,
    y: page.getHeight() - margin,
    size: 18,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(`Created: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, {
    x: margin,
    y: page.getHeight() - margin - 30,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  const laminationType = jobs[0]?.lamination_type || 'none';
  page.drawText(`Lamination: ${laminationType.charAt(0).toUpperCase() + laminationType.slice(1)}`, {
    x: margin,
    y: page.getHeight() - margin - 50,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  const sheetsRequired = Math.ceil(totalCards / 24);
  
  page.drawText(`Total Cards: ${totalCards}`, {
    x: margin,
    y: page.getHeight() - margin - 70,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  page.drawText(`Sheets Required: ${sheetsRequired}`, {
    x: margin,
    y: page.getHeight() - margin - 90,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
}

// Function to calculate column starting positions
export function calculateColumnStarts(margin: number, colWidths: number[]): number[] {
  const colStarts = [margin];
  
  for (let i = 1; i < colWidths.length; i++) {
    colStarts[i] = colStarts[i-1] + colWidths[i-1];
  }
  
  return colStarts;
}

// Function to draw table header
export function drawTableHeader(
  page: PDFPage,
  tableY: number,
  colStarts: number[],
  helveticaBold: any,
  margin: number,
  colWidths: number[]
): void {
  // Draw table header with bold font
  page.drawText("Job Name", {
    x: colStarts[0],
    y: tableY,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Due Date", {
    x: colStarts[1],
    y: tableY,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Quantity", {
    x: colStarts[2],
    y: tableY,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Double-sided", {
    x: colStarts[3],
    y: tableY,
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  // Draw separator line
  page.drawLine({
    start: { x: margin, y: tableY - 10 },
    end: { x: margin + colWidths.reduce((a, b) => a + b, 0), y: tableY - 10 },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
}

// Function to add a continuation page
export function addContinuationPage(
  pdfDoc: PDFDocument,
  batchName: string,
  margin: number,
  helveticaBold: any,
  colStarts: number[],
  helveticaFont: any,
  colWidths: number[]
): PDFPage {
  const page = addNewPage(pdfDoc);
  
  // Add continuation header
  page.drawText(`Batch Overview: ${batchName} (Continued)`, {
    x: margin,
    y: page.getHeight() - margin,
    size: 18,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  // Redraw table header on new page
  const tableY = page.getHeight() - margin - 50;
  drawTableHeader(page, tableY, colStarts, helveticaBold, margin, colWidths);
  
  return page;
}

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

// Function to draw the footer
export function drawFooter(
  page: PDFPage,
  margin: number,
  batchName: string,
  helveticaFont: any
): void {
  const footerY = margin - 20;
  page.drawText(`Generated on ${format(new Date(), 'yyyy-MM-dd HH:mm')} • Batch: ${batchName}`, {
    x: margin,
    y: footerY,
    size: 8,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5)
  });
}
