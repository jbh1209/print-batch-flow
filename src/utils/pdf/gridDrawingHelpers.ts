
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
  console.log("Drawing card grid with following data:");
  console.log("Valid job PDFs:", validJobPDFs.map(p => `Job ${p.job.id}`));
  console.log("PDF Pages for positions:", pdfPages?.map(p => ({
    jobId: p.job.id,
    position: p.position,
    quantity: p.job.quantity
  })));
  
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
      
      // Find page for this position
      const pageData = pdfPages?.find(p => p.position === positionIndex);
      
      if (pageData) {
        console.log(`Position ${positionIndex}: Drawing job ${pageData.job.id} (${pageData.job.name})`);
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
      } else {
        console.log(`Position ${positionIndex}: Drawing empty placeholder`);
        drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
      }
    }
  }
}

export { drawEmptyPlaceholder } from './placeholderDrawingHelpers';
