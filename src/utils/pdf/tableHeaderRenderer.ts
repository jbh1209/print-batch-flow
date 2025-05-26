
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
  // Draw header row background - reduced height
  page.drawRectangle({
    x: margin - 5,
    y: tableY - 5,
    width: 680,
    height: 20, // Reduced from 25 to 20
    color: rgb(0.95, 0.95, 0.95)
  });

  // Get headers based on job type
  const headers = calculateHeaderLabels(isBusinessCard, isSleeve);
  
  // Draw table header text - slightly smaller font
  headers.forEach((header, i) => {
    // Skip drawing headers beyond the available colStarts
    if (i >= colStarts.length) return;
    
    page.drawText(header, {
      x: colStarts[i],
      y: tableY - 2, // Adjusted vertical alignment
      size: 9, // Reduced from 10 to 9
      font,
      color: rgb(0.3, 0.3, 0.3)
    });
  });

  // Completely removed the black separator line
}
