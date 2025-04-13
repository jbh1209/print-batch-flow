
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";

// Convert mm to points (1 point = 1/72 inch, 1 inch = 25.4mm)
const mmToPoints = (mm: number) => mm * 72 / 25.4;

// Main function to generate the imposition sheet
export async function generateImpositionSheet(jobs: Job[]): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Add page with custom dimensions (320mm x 455mm)
  const pageWidth = mmToPoints(320);
  const pageHeight = mmToPoints(455);
  
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Get fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Define dimensions
  const dimensions = calculateDimensions(pageWidth, pageHeight);
  
  // Add batch information at the top of the sheet
  drawBatchInfo(page, jobs, helveticaFont, helveticaBold);
  
  // Load job PDFs
  const validJobPDFs = await loadJobPDFs(jobs);
  
  // Draw grid with job cards
  drawCardGrid(page, validJobPDFs, dimensions, helveticaFont, helveticaBold);
  
  // Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}

// Calculate dimensions for the card grid
function calculateDimensions(pageWidth: number, pageHeight: number) {
  // Define card dimensions (90mm x 50mm)
  const cardWidth = mmToPoints(90);
  const cardHeight = mmToPoints(50);
  
  // Define placeholder dimensions (96mm x 56mm)
  const placeholderWidth = mmToPoints(96);
  const placeholderHeight = mmToPoints(56);
  
  // Calculate grid layout (3x8)
  const columns = 3;
  const rows = 8;
  
  // Calculate spacing for centering on the sheet
  const totalGridWidth = columns * placeholderWidth;
  const totalGridHeight = rows * placeholderHeight;
  
  const horizontalMargin = (pageWidth - totalGridWidth) / 2;
  const verticalMargin = (pageHeight - totalGridHeight) / 2;
  
  return {
    cardWidth,
    cardHeight,
    placeholderWidth,
    placeholderHeight,
    columns,
    rows,
    horizontalMargin,
    verticalMargin,
    textAreaHeight: mmToPoints(6)
  };
}

// Draw batch information at the top of the sheet
function drawBatchInfo(
  page: any, 
  jobs: Job[], 
  helveticaFont: any, 
  helveticaBold: any
) {
  const laminationType = jobs[0]?.lamination_type || 'none';
  const formattedLamination = laminationType.charAt(0).toUpperCase() + laminationType.slice(1);
  
  page.drawText(`Business Card Imposition Sheet - ${formattedLamination} Lamination`, {
    x: mmToPoints(10),
    y: page.getHeight() - mmToPoints(10),
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Jobs: ${jobs.length} | Total Cards: ${totalCards} | Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, {
    x: mmToPoints(10),
    y: page.getHeight() - mmToPoints(20),
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
}

// Load all job PDFs
async function loadJobPDFs(jobs: Job[]) {
  const jobPDFs = await Promise.all(jobs.map(async (job) => {
    try {
      const response = await fetch(job.pdf_url);
      if (!response.ok) {
        console.error(`Failed to fetch PDF for job ${job.id}: ${response.statusText}`);
        return null;
      }
      const pdfBytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      return { job, pdfDoc };
    } catch (error) {
      console.error(`Error loading PDF for job ${job.id}:`, error);
      return null;
    }
  }));
  
  // Filter out any failed PDF loads
  return jobPDFs.filter(item => item !== null) as { job: Job; pdfDoc: PDFDocument }[];
}

// Draw the grid of cards on the imposition sheet
function drawCardGrid(
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
function drawEmptyPlaceholder(
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
async function drawJobPlaceholder(
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
async function embedJobPDF(
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
function drawJobInfo(
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
