
import { rgb } from "pdf-lib";
import { calculateHeaderLabels } from "./tableColumnUtils";

export function drawTableHeader(
  page: any,
  tableY: number,
  colStarts: number[],
  helveticaBold: any,
  margin: number,
  colWidths: number[],
  isBusinessCard: boolean
) {
  const headers = calculateHeaderLabels(isBusinessCard);
  
  // Draw table headers
  headers.forEach((header, i) => {
    page.drawText(header, {
      x: colStarts[i],
      y: tableY,
      size: 10,
      font: helveticaBold
    });
  });
  
  // Draw separator line
  page.drawLine({
    start: { x: margin, y: tableY - 10 },
    end: { x: margin + colWidths.reduce((a, b) => a + b, 0), y: tableY - 10 },
    thickness: 1,
    color: rgb(0, 0, 0)
  });
}
