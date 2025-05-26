
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import { format } from "date-fns";
import { drawTableHeader } from "./tableHeaderRenderer";

// Function to add a new A4 page
export function addNewPage(pdfDoc: PDFDocument): PDFPage {
  // A4 in points (72 points per inch)
  return pdfDoc.addPage([595.28, 841.89]);
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

// Function to calculate column starting positions
export function calculateColumnStarts(margin: number, colWidths: number[]): number[] {
  const colStarts = [margin];
  
  for (let i = 1; i < colWidths.length; i++) {
    colStarts[i] = colStarts[i-1] + colWidths[i-1];
  }
  
  return colStarts;
}
