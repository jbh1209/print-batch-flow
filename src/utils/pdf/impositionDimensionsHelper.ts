
import { mmToPoints } from "./pdfUnitHelpers";

// Calculate dimensions for the card grid
export function calculateDimensions(pageWidth: number, pageHeight: number) {
  // Define card dimensions (90mm x 50mm)
  const cardWidth = mmToPoints(90);
  const cardHeight = mmToPoints(50);
  
  // Define placeholder dimensions (96mm x 56mm)
  const placeholderWidth = mmToPoints(96);
  const placeholderHeight = mmToPoints(56);
  
  // Calculate grid layout (3x8 grid)
  const columns = 3;
  const rows = 8;
  
  // Calculate spacing for centering on the sheet
  const totalGridWidth = columns * placeholderWidth;
  const totalGridHeight = rows * placeholderHeight;
  
  const horizontalMargin = (pageWidth - totalGridWidth) / 2;
  const verticalMargin = (pageHeight - totalGridHeight) / 2;
  
  return {
    cardWidth,
    cardHeight,
    placeholderWidth,
    placeholderHeight,
    columns,
    rows,
    horizontalMargin,
    verticalMargin,
    textAreaHeight: mmToPoints(8) // Increased from 6mm to 8mm for better text display
  };
}
