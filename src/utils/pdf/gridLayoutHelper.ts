
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
  const headerHeight = 160; // Increased to account for business card info
  const footerHeight = 60;
  const availableHeight = pageHeight - headerHeight - footerHeight;
  
  // Calculate optimal grid based on job count and available space
  let columns = Math.min(3, jobCount); // Max 3 columns, but adjust based on job count
  let rows = Math.ceil(jobCount / columns);
  
  // Limit rows to ensure content fits with PDF previews
  const maxRows = Math.floor(availableHeight / 150); // Increased minimum height for PDF previews
  if (rows > maxRows) {
    rows = maxRows;
    columns = Math.min(4, Math.ceil(jobCount / rows));
  }
  
  // Calculate cell dimensions with proper spacing for PDF content
  const previewWidth = 500;
  const cellPadding = 30; // Increased padding for better spacing
  const cellWidth = Math.min(160, (previewWidth - (cellPadding * (columns + 1))) / columns); // Increased max width
  
  // Calculate cell height to accommodate PDF preview and text
  const availableRowHeight = availableHeight / rows;
  const cellHeight = Math.min(120, availableRowHeight - cellPadding); // Increased height for PDF content
  
  const startY = pageHeight - headerHeight - 30; // 30px buffer
  
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
