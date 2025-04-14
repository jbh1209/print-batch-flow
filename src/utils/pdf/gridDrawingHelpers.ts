
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { calculateDimensions } from "./impositionDimensionsHelper";
import { drawEmptyPlaceholder } from "./placeholderDrawingHelpers";
import { drawSpecificJobPage } from "./jobPageHelpers";

export async function drawCardGrid(
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
    page: p.page,
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

  // First, embed all unique PDFs with their required pages
  const embeddedPDFs = new Map<string, PDFDocument>();
  const embeddedPages = new Map<string, any[]>();

  if (pdfPages && pdfPages.length > 0) {
    console.log("Pre-embedding PDFs for all positions...");
    
    // Group pages by source PDF to embed each PDF only once
    const pdfGroups = new Map<string, Set<number>>();
    
    pdfPages.forEach(({ job, page: pageNum }) => {
      const jobId = job.id;
      if (!pdfGroups.has(jobId)) {
        pdfGroups.set(jobId, new Set());
      }
      pdfGroups.get(jobId)!.add(pageNum);
    });
    
    // Embed each PDF with all its needed pages
    for (const [jobId, pages] of pdfGroups.entries()) {
      const pageData = pdfPages.find(p => p.job.id === jobId);
      if (pageData) {
        try {
          console.log(`Embedding pages ${Array.from(pages)} from PDF for job ${jobId}`);
          const embedded = await page.doc.embedPdf(
            pageData.pdfDoc,
            Array.from(pages)
          );
          embeddedPDFs.set(jobId, pageData.pdfDoc);
          embeddedPages.set(jobId, embedded);
          console.log(`Successfully embedded ${embedded.length} pages for job ${jobId}`);
        } catch (error) {
          console.error(`Failed to embed PDF for job ${jobId}:`, error);
        }
      }
    }
  }

  // Draw placeholders in grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = horizontalMargin + col * placeholderWidth;
      const y = page.getHeight() - verticalMargin - (row + 1) * placeholderHeight;
      const positionIndex = row * columns + col;
      
      // Find page for this position
      const pageData = pdfPages?.find(p => p.position === positionIndex);
      
      if (pageData) {
        console.log(`Position ${positionIndex}: Drawing job ${pageData.job.id} (${pageData.job.name}) - Page ${pageData.page}`);
        
        // Get the pre-embedded pages for this job
        const jobPages = embeddedPages.get(pageData.job.id);
        if (jobPages && jobPages.length > pageData.page) {
          try {
            await drawSpecificJobPage(
              page,
              x,
              y,
              {
                ...pageData,
                embeddedPage: jobPages[pageData.page]
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
          console.warn(`No embedded page found for job ${pageData.job.id} at page ${pageData.page}`);
          drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
        }
      } else {
        console.log(`Position ${positionIndex}: Drawing empty placeholder`);
        drawEmptyPlaceholder(page, x, y, placeholderWidth, placeholderHeight, helveticaFont);
      }
    }
  }
}

export { drawEmptyPlaceholder } from './placeholderDrawingHelpers';
