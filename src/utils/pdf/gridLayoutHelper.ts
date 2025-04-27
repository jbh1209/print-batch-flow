
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
  // Reserve top 20% for job info, use bottom 80% for previews
  const previewAreaHeight = pageHeight * 0.8;
  const startY = pageHeight - (pageHeight * 0.2); // Start Y for preview grid
  const previewWidth = 510; // Slightly increased width for better spacing
  
  // Fixed 4x6 grid layout to handle up to 24 cards efficiently
  const columns = 4;
  const rows = 6;
  
  // Calculate cell dimensions based on available space
  const cellPadding = 8; // Reduced padding for tighter layout
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
