
// This file now serves as the main entry point for grid drawing functionality
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { calculateDimensions } from "./impositionDimensionsHelper";
import { drawEmptyPlaceholder } from "./placeholderDrawingHelpers";
import { drawSpecificJobPage } from "./jobPageHelpers";

export function drawCardGrid(
  page: any,
  validJobPDFs: { job: Job; pdfDoc: PDFDocument; isDuplicated?: boolean }[],
  dimensions: ReturnType<typeof calculateDimensions>,
  helveticaFont: any,
  helveticaBold: any,
  pdfPages?: { job: Job; pdfDoc: PDFDocument; page: number; position?: number }[]
) {
  console.log("Drawing card grid...");
  console.log("PDF Pages array:", pdfPages?.map(p => `Job ${p.job.id} at position ${p.position}`));
  
  const {
    placeholderWidth,
    placeholderHeight,
    columns,
    rows,
    horizontalMargin,
    verticalMargin,
    textAreaHeight
  } = dimensions;

  // Draw placeholders in grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = horizontalMargin + col * placeholderWidth;
      const y = page.getHeight() - verticalMargin - (row + 1) * placeholderHeight;
      const positionIndex = row * columns + col;
      
      console.log(`Processing grid position ${positionIndex}`);
      
      // Find page for this position
      const pageData = pdfPages?.find(p => p.position === positionIndex);
      
      if (!pageData) {
        console.log(`No job assigned to position ${positionIndex}, drawing empty placeholder`);
        drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
      } else {
        console.log(`Drawing job ${pageData.job.id} at position ${positionIndex}`);
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
    }
  }
}

export { drawEmptyPlaceholder } from './placeholderDrawingHelpers';

