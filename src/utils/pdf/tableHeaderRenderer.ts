
import { rgb } from "pdf-lib";
import { calculateHeaderLabels } from "./tableColumnUtils";

export function drawTableHeader(
  page: any, 
  tableY: number, 
  colStarts: number[], 
  font: any,
  margin: number,
  colWidths: number[] = [],
  isBusinessCard: boolean = false,
  isSleeve: boolean = false
) {
  // Draw header row background
  page.drawRectangle({
    x: margin - 5,
    y: tableY - 5,
    width: 680,
    height: 25,
    color: rgb(0.95, 0.95, 0.95)
  });

  // Get headers based on job type
  const headers = calculateHeaderLabels(isBusinessCard, isSleeve);
  
  // Draw table header text
  headers.forEach((header, i) => {
    page.drawText(header, {
      x: colStarts[i],
      y: tableY,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3)
    });
  });
}
