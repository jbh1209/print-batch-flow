
import { PDFPage, rgb } from "pdf-lib";
import { BaseJob } from "@/config/productTypes";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

export function drawFlyerInfo(
  page: PDFPage,
  jobs: FlyerJob[] | BaseJob[],
  margin: number,
  helveticaBold: any,
  helveticaFont: any,
  sheetsRequired: number
): void {
  // Since specifications are no longer hardcoded, we'll show generic paper info
  const paperWeight = 'Standard';
  const paperType = 'Paper';
  
  page.drawRectangle({
    x: margin - 5,
    y: page.getHeight() - margin - 75,
    width: 200,
    height: 30,
    color: rgb(0.102, 0.122, 0.173),
  });
  
  page.drawText(`Paper: ${paperWeight} ${paperType}`, {
    x: margin,
    y: page.getHeight() - margin - 60,
    size: 12,
    font: helveticaBold,
    color: rgb(1, 1, 1)
  });
  
  // Fix the totalPieces calculation to handle different job types correctly
  const totalPieces = jobs.reduce((sum, job) => {
    // Ensure quantity is treated as a number
    const quantity = typeof job.quantity === 'number' ? job.quantity : 0;
    return sum + quantity;
  }, 0);
  
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
