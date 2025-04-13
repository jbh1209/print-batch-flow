
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { format } from "date-fns";
import { calculateDimensions } from "./impositionDimensionsHelper";
import { mmToPoints } from "./pdfUnitHelpers";

// Draw the grid of cards on the imposition sheet
export function drawCardGrid(
  page: any,
  validJobPDFs: { job: Job; pdfDoc: PDFDocument }[],
  dimensions: ReturnType<typeof calculateDimensions>,
  helveticaFont: any,
  helveticaBold: any
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
  
  // Draw placeholders in 3x8 grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      // Calculate position of this placeholder
      const x = horizontalMargin + col * placeholderWidth;
      const y = page.getHeight() - verticalMargin - (row + 1) * placeholderHeight;
      
      // Calculate which job this position corresponds to
      const positionIndex = row * columns + col;
      
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

// Draw an empty placeholder when there's no job
export function drawEmptyPlaceholder(
  page: any, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  font: any
) {
  // Draw empty placeholder
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.95, 0.95, 0.95)
  });
  
  // Draw text indicating empty
  page.drawText("Empty", {
    x: x + width / 2 - 15,
    y: y + height / 2,
    size: 12,
    font,
    color: rgb(0.5, 0.5, 0.5)
  });
}

// Draw a job placeholder with embedded PDF
export async function drawJobPlaceholder(
  page: any,
  x: number,
  y: number,
  jobData: { job: Job; pdfDoc: PDFDocument },
  placeholderWidth: number,
  placeholderHeight: number,
  textAreaHeight: number,
  helveticaFont: any,
  helveticaBold: any
) {
  const { job, pdfDoc: jobPdfDoc } = jobData;
  
  // Draw placeholder border
  page.drawRectangle({
    x,
    y,
    width: placeholderWidth,
    height: placeholderHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });
  
  // Try to embed the first page of the job PDF
  try {
    await embedJobPDF(
      page, 
      jobPdfDoc, 
      x, 
      y, 
      placeholderWidth, 
      placeholderHeight, 
      textAreaHeight
    );
  } catch (error) {
    console.error(`Error embedding PDF for job ${job.id}:`, error);
    
    // Draw error message
    page.drawText("Error loading PDF", {
      x: x + placeholderWidth / 2 - 40,
      y: y + placeholderHeight / 2,
      size: 10,
      font: helveticaFont,
      color: rgb(0.8, 0, 0)
    });
  }
  
  // Draw job info at the bottom
  drawJobInfo(page, job, x, y, placeholderWidth, textAreaHeight, helveticaFont, helveticaBold);
}

// Embed the job PDF into the placeholder
export async function embedJobPDF(
  page: any,
  jobPdfDoc: PDFDocument,
  x: number,
  y: number,
  placeholderWidth: number,
  placeholderHeight: number,
  textAreaHeight: number
) {
  if (jobPdfDoc.getPageCount() > 0) {
    const [jobFirstPage] = await page.doc.embedPdf(jobPdfDoc, [0]);
    
    // Calculate scaling to fit the card area while preserving aspect ratio
    const originalWidth = jobFirstPage.width;
    const originalHeight = jobFirstPage.height;
    
    // Leave space for text at bottom
    const availableHeight = placeholderHeight - textAreaHeight;
    
    // Calculate scale factors for width and height
    const scaleX = (placeholderWidth - mmToPoints(6)) / originalWidth;
    const scaleY = (availableHeight - mmToPoints(6)) / originalHeight;
    
    // Use the smaller scale factor to ensure it fits
    const scale = Math.min(scaleX, scaleY);
    
    // Calculate dimensions after scaling
    const scaledWidth = originalWidth * scale;
    const scaledHeight = originalHeight * scale;
    
    // Calculate position to center within placeholder
    const embedX = x + (placeholderWidth - scaledWidth) / 2;
    const embedY = y + textAreaHeight + (availableHeight - scaledHeight) / 2;
    
    // Draw the embedded PDF page
    page.drawPage(jobFirstPage, {
      x: embedX,
      y: embedY,
      width: scaledWidth,
      height: scaledHeight
    });
  }
}

// Draw job information at the bottom of the placeholder
export function drawJobInfo(
  page: any,
  job: Job,
  x: number,
  y: number,
  placeholderWidth: number,
  textAreaHeight: number,
  helveticaFont: any,
  helveticaBold: any
) {
  // Draw semitransparent white background for text area
  page.drawRectangle({
    x,
    y,
    width: placeholderWidth,
    height: textAreaHeight,
    color: rgb(1, 1, 1),
    opacity: 0.8
  });
  
  // Draw job name (truncated if necessary)
  let jobName = job.name;
  if (jobName.length > 15) {
    jobName = jobName.substring(0, 12) + "...";
  }
  
  page.drawText(jobName, {
    x: x + 2,
    y: y + mmToPoints(3),
    size: 7,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  // Draw quantity and due date
  const infoText = `Qty: ${job.quantity} | Due: ${format(new Date(job.due_date), 'MMM dd')}`;
  page.drawText(infoText, {
    x: x + placeholderWidth - 60,
    y: y + mmToPoints(3),
    size: 6,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
}
