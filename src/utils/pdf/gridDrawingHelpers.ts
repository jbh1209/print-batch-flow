
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { calculateDimensions } from "./impositionDimensionsHelper";
import { drawEmptyPlaceholder } from "./placeholderDrawingHelpers";
import { drawSpecificJobPage } from "./jobPageHelpers";
import { PositionMapping } from "./jobPdfLoader";

/**
 * Draw the entire card grid with proper positioning
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
 */
async function embedAllPdfPages(page: any, positionMappings: PositionMapping[]) {
  // Group by document to optimize embedding
  const pdfGrouping = new Map<string, {
    doc: PDFDocument,
    pages: Set<number>,
    mappings: PositionMapping[]
  }>();
  
  // First pass - group all PDFs by job ID and collect page numbers
  console.log("Grouping PDFs by job ID for efficient embedding...");
  positionMappings.forEach(mapping => {
    const jobId = mapping.job.id;
    
    if (!pdfGrouping.has(jobId)) {
      pdfGrouping.set(jobId, {
        doc: mapping.pdfDoc,
        pages: new Set<number>(),
        mappings: []
      });
    }
    
    const group = pdfGrouping.get(jobId)!;
    group.pages.add(mapping.page);
    group.mappings.push(mapping);
  });
  
  // Second pass - embed each PDF once with all necessary pages
  console.log(`Embedding ${pdfGrouping.size} unique PDFs...`);
  
  for (const [jobId, group] of pdfGrouping.entries()) {
    const pageArray = Array.from(group.pages);
    
    console.log(`Job ${jobId}: Embedding ${pageArray.length} pages: ${pageArray.join(', ')}`);
    
    try {
      // Embed the PDF with all required pages in one operation
      const embeddedPages = await page.doc.embedPdf(group.doc, pageArray);
      
      // Map each embedded page back to its position mapping
      pageArray.forEach((pageNum, index) => {
        const embeddedPage = embeddedPages[index];
        
        // Find all mappings that need this page
        const mappingsForPage = group.mappings.filter(m => m.page === pageNum);
        
        mappingsForPage.forEach(mapping => {
          mapping.embeddedPage = embeddedPage;
          console.log(`✓ Successfully associated embedded page with position ${mapping.position} (job ${jobId}, page ${pageNum})`);
        });
      });
      
      console.log(`✓ Successfully embedded all pages for job ${jobId}`);
    } catch (error) {
      console.error(`Failed to embed PDF for job ${jobId}:`, error);
    }
  }
  
  // Verification - ensure all mappings have embedded pages
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
