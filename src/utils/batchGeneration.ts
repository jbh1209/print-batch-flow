
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";
import { PDFDocument, PDFPage, rgb, StandardFonts } from "pdf-lib";

// Main function to generate the batch overview PDF
export async function generateBatchOverview(jobs: Job[], batchName: string): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Embed fonts for later use
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Create first page and draw header content
  let page = addNewPage(pdfDoc);
  
  // Page margins
  const margin = 50;
  
  // Draw batch information
  drawBatchInfo(page, batchName, jobs, helveticaFont, helveticaBold, margin);
  
  // Draw table header
  const tableY = page.getHeight() - margin - 140;
  const colWidths = [220, 100, 80, 80];
  const colStarts = calculateColumnStarts(margin, colWidths);
  
  drawTableHeader(page, tableY, colStarts, helveticaBold, margin, colWidths);
  
  // Draw table rows
  let rowY = tableY - 30;
  const rowHeight = 20;
  
  // Draw job entries
  page = drawJobEntries(
    pdfDoc, page, jobs, rowY, margin, rowHeight, 
    colStarts, helveticaFont, helveticaBold, batchName
  );
  
  // Add footer
  drawFooter(page, margin, batchName, helveticaFont);
  
  // Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}

// Function to add a new A4 page
function addNewPage(pdfDoc: PDFDocument): PDFPage {
  // A4 in points (72 points per inch)
  return pdfDoc.addPage([595.28, 841.89]);
}

// Function to draw batch information
function drawBatchInfo(
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
function calculateColumnStarts(margin: number, colWidths: number[]): number[] {
  const colStarts = [margin];
  
  for (let i = 1; i < colWidths.length; i++) {
    colStarts[i] = colStarts[i-1] + colWidths[i-1];
  }
  
  return colStarts;
}

// Function to draw table header
function drawTableHeader(
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

// Function to draw job entries in the table
function drawJobEntries(
  pdfDoc: PDFDocument,
  page: PDFPage,
  jobs: Job[],
  rowY: number,
  margin: number,
  rowHeight: number,
  colStarts: number[],
  helveticaFont: any,
  helveticaBold: any,
  batchName: string
): PDFPage {
  jobs.forEach((job, index) => {
    // If we're about to go off the page, add a new page
    if (rowY < margin + 30) {
      page = addContinuationPage(
        pdfDoc, 
        batchName, 
        margin, 
        helveticaBold, 
        colStarts,
        helveticaFont
      );
      rowY = page.getHeight() - margin - 80; // Start a bit lower on continuation pages
    }
    
    // Draw job row
    page = drawJobRow(
      page, 
      job, 
      rowY, 
      colStarts, 
      helveticaFont, 
      margin, 
      colWidths,
      rowHeight, 
      index
    );
    
    rowY -= rowHeight;
  });
  
  return page;
}

// Function to add a continuation page
function addContinuationPage(
  pdfDoc: PDFDocument,
  batchName: string,
  margin: number,
  helveticaBold: any,
  colStarts: number[],
  helveticaFont: any
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
  const totalWidth = colStarts[colStarts.length - 1] + 80; // Approximate total width
  page.drawLine({
    start: { x: margin, y: tableY - 10 },
    end: { x: totalWidth, y: tableY - 10 },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
  
  return page;
}

// Function to draw a single job row
function drawJobRow(
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
function drawFooter(
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
