
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { calculateDimensions } from "./impositionDimensionsHelper";
import { drawEmptyPlaceholder } from "./placeholderDrawingHelpers";
import { drawSpecificJobPage } from "./jobPageHelpers";
import { PositionMapping } from "./jobPdfLoader";

/**
 * Draw the entire card grid with proper positioning
 * COMPLETELY REWRITTEN using a two-phase approach:
 * 1. First embed all PDFs
 * 2. Then draw all positions
 */
export async function drawCardGrid(
  page: any,
  dimensions: ReturnType<typeof calculateDimensions>,
  helveticaFont: any,
  helveticaBold: any,
  positionMappings?: PositionMapping[]
) {
  console.log("Drawing card grid with following data:");
  console.log("Position mappings count:", positionMappings?.length || 0);
  
  const {
    placeholderWidth,
    placeholderHeight,
    columns,
    rows,
    horizontalMargin,
    verticalMargin,
    textAreaHeight
  } = dimensions;

  // STEP 1: First, embed all PDF pages that will be needed
  // This is critical - we must embed all pages BEFORE drawing any of them
  if (positionMappings && positionMappings.length > 0) {
    console.log("=== PHASE 1: EMBEDDING ALL PDFS ===");
    await embedAllPdfPages(page, positionMappings);
  }

  // STEP 2: Now that all PDFs are embedded, draw the grid
  console.log("=== PHASE 2: DRAWING GRID WITH EMBEDDED PDFS ===");
  
  // Draw placeholders in grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = horizontalMargin + col * placeholderWidth;
      const y = page.getHeight() - verticalMargin - (row + 1) * placeholderHeight;
      const positionIndex = row * columns + col;
      
      // Find position mapping for this grid position
      const positionMapping = positionMappings?.find(m => m.position === positionIndex);
      
      if (positionMapping && positionMapping.embeddedPage) {
        console.log(`Drawing position ${positionIndex}: Job ${positionMapping.job.id} (${positionMapping.job.name}) - Page ${positionMapping.page}`);
        
        try {
          await drawSpecificJobPage(
            page,
            x,
            y,
            positionMapping,
            placeholderWidth,
            placeholderHeight,
            textAreaHeight,
            helveticaFont,
            helveticaBold
          );
        } catch (error) {
          console.error(`Error drawing position ${positionIndex}:`, error);
          drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
        }
      } else {
        console.log(`Position ${positionIndex}: Empty placeholder (no mapping)`);
        drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
      }
    }
  }
}

/**
 * Embed all PDF pages needed for the entire sheet in one go
 * This ensures all pages are embedded before any drawing happens
 * COMPLETELY REWRITTEN to fix reference issues
 */
async function embedAllPdfPages(page: any, positionMappings: PositionMapping[]) {
  console.log(`Embedding ALL PDFs for ${positionMappings.length} positions in ONE BATCH`);
  
  // Process each position mapping directly - no more grouping by job ID
  // This ensures each position maintains its own PDF reference
  for (const mapping of positionMappings) {
    try {
      console.log(`Embedding PDF for position ${mapping.position} (job ${mapping.job.id}, page ${mapping.page})`);
      
      // Embed just this specific page from this specific position's PDF copy
      const embeddedPages = await page.doc.embedPdf(mapping.pdfDoc, [mapping.page]);
      
      if (!embeddedPages || embeddedPages.length === 0) {
        console.error(`Failed to embed PDF for position ${mapping.position}`);
        continue;
      }
      
      // Store the embedded page reference directly in this position mapping
      mapping.embeddedPage = embeddedPages[0];
      console.log(`✓ Successfully embedded PDF for position ${mapping.position}`);
    } catch (error) {
      console.error(`Error embedding PDF for position ${mapping.position}:`, error);
    }
  }
  
  // Final verification - check for any positions missing embedded pages
  const missingEmbeds = positionMappings.filter(m => !m.embeddedPage);
  if (missingEmbeds.length > 0) {
    console.error(`WARNING: ${missingEmbeds.length} positions are missing embedded pages`);
    missingEmbeds.forEach(m => {
      console.error(`- Position ${m.position}, Job ${m.job.id}, Page ${m.page}`);
    });
  } else {
    console.log("✓ All position mappings have embedded pages");
  }
}

export { drawEmptyPlaceholder } from './placeholderDrawingHelpers';
