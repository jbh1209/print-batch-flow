
import { PDFPage, rgb } from "pdf-lib";
import { FlyerJob, BaseJob } from "@/config/productTypes";

export function drawFlyerInfo(
  page: PDFPage,
  jobs: FlyerJob[] | BaseJob[],
  margin: number,
  helveticaBold: any,
  helveticaFont: any,
  sheetsRequired: number
): void {
  const paperWeight = jobs[0]?.paper_weight || 'N/A';
  const paperType = jobs[0]?.paper_type || 'N/A';
  
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
