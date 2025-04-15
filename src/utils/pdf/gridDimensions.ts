
import { mmToPoints } from "./pdfUnitHelpers";

export function calculateGridDimensions(pageWidth: number, pageHeight: number) {
  // Card dimensions (90x50mm with 3mm bleed area)
  const placeholderWidth = mmToPoints(96);
  const placeholderHeight = mmToPoints(56);
  
  // Grid layout (3x8 grid)
  const columns = 3;
  const rows = 8;
  
  // Calculate margins to center on the sheet
  const totalGridWidth = columns * placeholderWidth;
  const totalGridHeight = rows * placeholderHeight;
  
  const horizontalMargin = (pageWidth - totalGridWidth) / 2;
  const verticalMargin = (pageHeight - totalGridHeight) / 2;
  
  return {
    placeholderWidth,
    placeholderHeight,
    columns,
    rows,
    horizontalMargin,
    verticalMargin,
    textAreaHeight: mmToPoints(8)
  };
}
