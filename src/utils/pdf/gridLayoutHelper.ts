
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
  
  // Calculate optimal grid based on job count and available space
  if (jobCount <= 4) {
    // 2x2 grid
    return {
      columns: 2,
      rows: 2,
      cellWidth: 250,
      cellHeight: previewAreaHeight / 2.5, // Allow for padding
      startY,
      padding: 20
    };
  } else if (jobCount <= 6) {
    // 3x2 grid
    return {
      columns: 3,
      rows: 2,
      cellWidth: 160,
      cellHeight: previewAreaHeight / 2.5,
      startY,
      padding: 15
    };
  } else {
    // 3x3 grid
    return {
      columns: 3,
      rows: 3,
      cellWidth: 160,
      cellHeight: previewAreaHeight / 3.5,
      startY,
      padding: 15
    };
  }
}
