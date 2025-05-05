
import { PDFPage, rgb } from "pdf-lib";
import { BaseJob } from "@/config/productTypes";

export function drawSleeveInfo(
  page: PDFPage,
  jobs: BaseJob[],
  margin: number,
  helveticaBold: any,
  helveticaFont: any,
  sheetsRequired: number
): void {
  // Safely access stock_type or provide a default
  const firstJob = jobs[0] || {};
  const stockType = firstJob.stock_type || 'Standard';
  
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 75,
    width: 150,
    height: 30,
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(`Stock: ${stockType}`, {
    x: margin,
    y: page.getHeight() - margin - 60,
    size: 12,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  const totalPieces = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Pieces: ${totalPieces}`, {
    x: margin,
    y: page.getHeight() - margin - 90,
    size: 12,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  page.drawRectangle({
    x: 400,
    y: page.getHeight() - margin - 75,
    width: 180,
    height: 30,
    color: rgb(0.102, 0.122, 0.173),
  });
  
  const estimatedSheets = sheetsRequired > 0 ? sheetsRequired : Math.ceil(totalPieces / 4);
  
  page.drawText(`Sheets: ${estimatedSheets}`, {
    x: 410,
    y: page.getHeight() - margin - 60,
    size: 12,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
}
