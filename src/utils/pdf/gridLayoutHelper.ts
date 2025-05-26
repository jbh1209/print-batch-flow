
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
  console.log("Calculating grid layout for", jobCount, "jobs, page height:", pageHeight);
  
  // Reserve space more accurately based on actual layout
  const headerHeight = 140; // Space for batch info and table
  const footerHeight = 60;  // Space for footer
  const availableHeight = pageHeight - headerHeight - footerHeight;
  
  // Calculate optimal grid based on job count and available space
  let columns = 3; // Default to 3 columns
  let rows = Math.ceil(jobCount / columns);
  
  // Limit rows to ensure content fits
  const maxRows = Math.floor(availableHeight / 120); // Minimum 120px per row
  if (rows > maxRows) {
    rows = maxRows;
    columns = Math.min(4, Math.ceil(jobCount / rows)); // Adjust columns if needed
  }
  
  // Calculate cell dimensions with proper spacing
  const previewWidth = 500; // Available width for previews
  const cellPadding = 25;
  const cellWidth = Math.min(140, (previewWidth - (cellPadding * (columns + 1))) / columns);
  
  // Calculate cell height to maintain good proportions
  const availableRowHeight = availableHeight / rows;
  const cellHeight = Math.min(100, availableRowHeight - cellPadding);
  
  // Start position from top
  const startY = pageHeight - headerHeight - 20; // 20px buffer
  
  console.log("Grid layout calculated:", {
    columns,
    rows,
    cellWidth,
    cellHeight,
    startY,
    availableHeight,
    maxRows
  });
  
  return {
    columns,
    rows,
    cellWidth,
    cellHeight,
    startY,
    padding: cellPadding
  };
}
