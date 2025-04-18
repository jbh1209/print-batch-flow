
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
  // Reserve top 25% for job info, use bottom 75% for previews
  const previewAreaHeight = pageHeight * 0.75;
  const startY = pageHeight - (pageHeight * 0.25); // Start Y for preview grid
  const previewWidth = 500; // Estimated total width available for previews
  
  // Calculate optimal grid based on job count and available space
  let columns: number;
  let rows: number;
  
  if (jobCount <= 2) {
    // 2x1 grid for 1-2 jobs
    columns = 2;
    rows = 1;
  } else if (jobCount <= 4) {
    // 2x2 grid for 3-4 jobs
    columns = 2;
    rows = 2;
  } else if (jobCount <= 6) {
    // 3x2 grid for 5-6 jobs
    columns = 3;
    rows = 2;
  } else if (jobCount <= 9) {
    // 3x3 grid for 7-9 jobs
    columns = 3;
    rows = 3;
  } else {
    // 4x3 grid for 10+ jobs
    columns = 4;
    rows = 3;
  }
  
  // Calculate cell dimensions based on available space
  const cellPadding = 10;
  const cellWidth = (previewWidth - (cellPadding * (columns + 1))) / columns;
  const cellHeight = (previewAreaHeight - (cellPadding * (rows + 1))) / rows;
  
  return {
    columns,
    rows,
    cellWidth,
    cellHeight,
    startY,
    padding: cellPadding
  };
}
