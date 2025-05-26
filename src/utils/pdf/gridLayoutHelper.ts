
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
  const startY = pageHeight - (pageHeight * 0.3) - 150; // Additional offset to avoid overlap with table
  const previewWidth = 510; // Width for preview area
  
  // Adjust grid layout based on job count
  const columns = 3; // 3 columns for sleeve boxes
  const rows = Math.ceil(jobCount / columns);
  const maxRows = 4; // Limit rows to ensure they fit on the page
  
  // Calculate cell dimensions based on available space
  const cellPadding = 10;
  const cellWidth = (previewWidth - (cellPadding * (columns + 1))) / columns;
  
  // Make sure cell height is proportional for sleeve boxes (which are more square)
  const cellHeight = cellWidth * 1.2; // Height is 120% of width for sleeve boxes
  
  return {
    columns,
    rows: Math.min(rows, maxRows),
    cellWidth,
    cellHeight,
    startY,
    padding: cellPadding
  };
}
