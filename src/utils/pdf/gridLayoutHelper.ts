
import { PDFDocument, PDFPage } from "pdf-lib";
import { mmToPoints } from "./pdfUnitHelpers";

interface GridConfig {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  startY: number;
  padding: number;
}

export function calculateGridLayout(jobCount: number, pageHeight: number): GridConfig {
  // Reserve top 30% for job info and table, use bottom 70% for previews
  const previewAreaHeight = pageHeight * 0.7;
  // Start Y positioned lower to avoid overlapping with the job table
  const startY = pageHeight - (pageHeight * 0.3) - 90; // Additional 90pts offset
  const previewWidth = 510; // Width for preview area
  
  // Fixed 4x6 grid layout to handle up to 24 cards efficiently
  const columns = 4;
  const rows = 6;
  
  // Calculate cell dimensions based on available space
  const cellPadding = 8;
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
