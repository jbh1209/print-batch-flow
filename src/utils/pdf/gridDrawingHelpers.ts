
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { calculateDimensions } from "./impositionDimensionsHelper";
import { drawEmptyPlaceholder } from "./placeholderDrawingHelpers";
import { drawSpecificJobPage } from "./jobPageHelpers";
import { PositionMapping } from "./jobPdfLoader";

/**
 * Draw the entire card grid with proper positioning
 * This has been updated to use the position mapping system
 */
export async function drawCardGrid(
  page: any,
  validJobPDFs: { job: Job; pdfDoc: PDFDocument; isDuplicated?: boolean }[],
  dimensions: ReturnType<typeof calculateDimensions>,
  helveticaFont: any,
  helveticaBold: any,
  positionMappings?: PositionMapping[]
) {
  console.log("Drawing card grid with following data:");
  console.log("Valid job PDFs:", validJobPDFs.map(p => `Job ${p.job.id}`));
  console.log("Position mappings:", positionMappings?.map(p => ({
    jobId: p.job.id,
    position: p.position,
    page: p.page
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

  // First, embed all pages from all PDFs with their required pages
  // This is a key optimization - we only embed each PDF once
  const embeddedPages = new Map<string, Map<number, any>>();

  if (positionMappings && positionMappings.length > 0) {
    console.log("Pre-embedding PDFs for all positions...");
    
    // Step 1: Group by job ID and collect all required pages
    const pagesByJob = new Map<string, Set<number>>();
    
    positionMappings.forEach(mapping => {
      const jobId = mapping.job.id;
      if (!pagesByJob.has(jobId)) {
        pagesByJob.set(jobId, new Set<number>());
      }
      pagesByJob.get(jobId)!.add(mapping.page);
    });
    
    // Step 2: Embed each PDF once with all its required pages
    for (const [jobId, pageSet] of pagesByJob.entries()) {
      const pageArray = Array.from(pageSet);
      const mapping = positionMappings.find(m => m.job.id === jobId);
      
      if (mapping) {
        try {
          console.log(`Embedding PDF for job ${jobId} with pages ${pageArray}`);
          
          // Embed all required pages at once
          const embeddedPdfPages = await page.doc.embedPdf(
            mapping.pdfDoc,
            pageArray
          );
          
          // Create a map of page number -> embedded page
          const pageMap = new Map<number, any>();
          pageArray.forEach((pageNum, index) => {
            pageMap.set(pageNum, embeddedPdfPages[index]);
          });
          
          // Store in our main map
          embeddedPages.set(jobId, pageMap);
          
          console.log(`Successfully embedded ${embeddedPdfPages.length} pages for job ${jobId}`);
        } catch (error) {
          console.error(`Failed to embed PDF for job ${jobId}:`, error);
        }
      }
    }
    
    // Step 3: Add embedded pages reference to each position mapping
    positionMappings.forEach(mapping => {
      const jobId = mapping.job.id;
      const pageMap = embeddedPages.get(jobId);
      
      if (pageMap && pageMap.has(mapping.page)) {
        mapping.embeddedPage = pageMap.get(mapping.page);
      }
    });
  }

  // Draw placeholders in grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = horizontalMargin + col * placeholderWidth;
      const y = page.getHeight() - verticalMargin - (row + 1) * placeholderHeight;
      const positionIndex = row * columns + col;
      
      // Find position mapping for this grid position
      const positionMapping = positionMappings?.find(m => m.position === positionIndex);
      
      if (positionMapping && positionMapping.embeddedPage) {
        console.log(`Position ${positionIndex}: Drawing job ${positionMapping.job.id} (${positionMapping.job.name}) - Page ${positionMapping.page}`);
        
        try {
          await drawSpecificJobPage(
            page,
            x,
            y,
            {
              job: positionMapping.job,
              pdfDoc: positionMapping.pdfDoc,
              page: positionMapping.page,
              embeddedPage: positionMapping.embeddedPage
            },
            placeholderWidth,
            placeholderHeight,
            textAreaHeight,
            helveticaFont,
            helveticaBold
          );
        } catch (error) {
          console.error(`Error drawing page at position ${positionIndex}:`, error);
          drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
        }
      } else {
        console.log(`Position ${positionIndex}: Drawing empty placeholder (no mapping found)`);
        drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
      }
    }
  }
}

export { drawEmptyPlaceholder } from './placeholderDrawingHelpers';
