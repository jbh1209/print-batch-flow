
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
  pdfPages?: { job: Job; pdfDoc: PDFDocument; page: number; position?: number }[]
) {
  console.log("Drawing card grid...");
  console.log(`validJobPDFs: ${validJobPDFs.length}, pdfPages: ${pdfPages?.length || 'none'}`);
  
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
  console.log(`Using page duplication mode: ${usePageDuplication}`);
  
  // Draw placeholders in grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      // Calculate position of this placeholder
      const x = horizontalMargin + col * placeholderWidth;
      const y = page.getHeight() - verticalMargin - (row + 1) * placeholderHeight;
      
      // Calculate which job this position corresponds to
      const positionIndex = row * columns + col;
      console.log(`Drawing position ${positionIndex} at (${x}, ${y})`);
      
      if (usePageDuplication) {
        // Look for a page with this exact position
        const pageData = pdfPages?.find(p => p.position === positionIndex);
        
        if (!pageData) {
          // Draw empty placeholder when no job is assigned to this position
          console.log(`Drawing empty placeholder at position ${positionIndex} (no matching page)`);
          drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
        } else {
          // Draw specific page from job PDF
          console.log(`Drawing job ${pageData.job.id} (${pageData.job.name}) at position ${positionIndex}`);
          
          // Better null checking before attempting to draw
          if (!pageData.job || !pageData.pdfDoc) {
            console.error(`Null page data for position ${positionIndex}`);
            drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
            continue;
          }
          
          // This is critical for duplication - we use the specific page data
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
        // Original behavior without page duplication (fallback)
        if (positionIndex >= validJobPDFs.length) {
          // Draw empty placeholder
          console.log(`Drawing empty placeholder at position ${positionIndex} (fallback mode)`);
          drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
        } else {
          // Draw job placeholder with PDF
          console.log(`Drawing job at position ${positionIndex} (fallback mode)`);
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
