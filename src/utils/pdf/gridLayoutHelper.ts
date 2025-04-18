
import { PDFDocument, PDFPage } from "pdf-lib";

interface GridConfig {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  startY: number;
  padding: number;
}

export function calculateGridLayout(jobCount: number, pageHeight: number): GridConfig {
  // Define grid configurations based on job count
  if (jobCount <= 4) {
    // 2x2 grid
    return {
      columns: 2,
      rows: 2,
      cellWidth: 250, // ~Half of A4 width with margins
      cellHeight: 180,
      startY: pageHeight - 400, // Position below batch info
      padding: 20
    };
  } else if (jobCount <= 6) {
    // 3x2 grid
    return {
      columns: 3,
      rows: 2,
      cellWidth: 160,
      cellHeight: 180,
      startY: pageHeight - 400,
      padding: 15
    };
  } else {
    // 3x3 grid
    return {
      columns: 3,
      rows: 3,
      cellWidth: 160,
      cellHeight: 120,
      startY: pageHeight - 400,
      padding: 15
    };
  }
}
