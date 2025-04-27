
import { PDFPage, rgb } from "pdf-lib";
import { format } from "date-fns";

export function drawBatchHeader(
  page: PDFPage,
  batchName: string,
  helveticaBold: any,
  helveticaFont: any,
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
}
