// This file now serves as the main entry point for grid drawing functionality
// but delegates most work to other specialized modules

import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { calculateDimensions } from "./impositionDimensionsHelper";
import { drawEmptyPlaceholder } from "./placeholderDrawingHelpers";
import { drawSpecificJobPage } from "./jobPageHelpers";
import { drawJobPlaceholder } from "./jobPlaceholderHelpers";

// Main function to draw the grid of cards on the imposition sheet
export function drawCardGrid(
  page: any,
  validJobPDFs: { job: Job; pdfDoc: PDFDocument; isDuplicated?: boolean }[],
  dimensions: ReturnType<typeof calculateDimensions>,
  helveticaFont: any,
  helveticaBold: any,
  pdfPages?: { job: Job; pdfDoc: PDFDocument; page: number }[]
) {
  const {
    placeholderWidth,
    placeholderHeight,
    columns,
    rows,
    horizontalMargin,
    verticalMargin,
    textAreaHeight
  } = dimensions;
  
  // If using page duplication for imposition
  const usePageDuplication = Array.isArray(pdfPages) && pdfPages.length > 0;
  
  // Draw placeholders in 3x8 grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      // Calculate position of this placeholder
      const x = horizontalMargin + col * placeholderWidth;
      const y = page.getHeight() - verticalMargin - (row + 1) * placeholderHeight + mmToPoints(3); // Add slight offset for better layout
      
      // Calculate which job this position corresponds to
      const positionIndex = row * columns + col;
      
      if (usePageDuplication) {
        // Draw from specific page array (either front or back)
        if (positionIndex >= pdfPages!.length) {
          // Draw empty placeholder
          drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
        } else {
          // Draw specific page from job PDF
          const pageData = pdfPages![positionIndex];
          drawSpecificJobPage(
            page, 
            x, 
            y, 
            pageData, 
            placeholderWidth, 
            placeholderHeight, 
            textAreaHeight, 
            helveticaFont, 
            helveticaBold
          );
        }
      } else {
        // Original behavior without page duplication
        if (positionIndex >= validJobPDFs.length) {
          // Draw empty placeholder
          drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
        } else {
          // Draw job placeholder with PDF
          const jobData = validJobPDFs[positionIndex];
          drawJobPlaceholder(
            page, 
            x, 
            y, 
            jobData, 
            placeholderWidth, 
            placeholderHeight, 
            textAreaHeight, 
            helveticaFont, 
            helveticaBold
          );
        }
      }
    }
  }
}

// Re-export functions from other files for backward compatibility
export { drawEmptyPlaceholder } from './placeholderDrawingHelpers';

// Helper function used internally
import { mmToPoints } from "./pdfUnitHelpers";
