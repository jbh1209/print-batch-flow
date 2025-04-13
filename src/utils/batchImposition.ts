
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";

export async function generateImpositionSheet(jobs: Job[]): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Add page with custom dimensions (320mm x 455mm)
  // Convert mm to points (1 point = 1/72 inch, 1 inch = 25.4mm)
  const mmToPoints = (mm: number) => mm * 72 / 25.4;
  const pageWidth = mmToPoints(320);
  const pageHeight = mmToPoints(455);
  
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  
  // Get fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
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
  
  // Load all job PDFs to get the first page of each
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
  const validJobPDFs = jobPDFs.filter(item => item !== null) as { job: Job; pdfDoc: PDFDocument }[];
  
  // Draw placeholders in 3x8 grid
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      // Calculate position of this placeholder
      const x = horizontalMargin + col * placeholderWidth;
      const y = pageHeight - verticalMargin - (row + 1) * placeholderHeight;
      
      // Calculate which job this position corresponds to
      const positionIndex = row * columns + col;
      
      // If we have run out of jobs, leave empty placeholders
      if (positionIndex >= validJobPDFs.length) {
        // Draw empty placeholder
        page.drawRectangle({
          x,
          y,
          width: placeholderWidth,
          height: placeholderHeight,
          borderColor: rgb(0.7, 0.7, 0.7),
          borderWidth: 1,
          color: rgb(0.95, 0.95, 0.95)
        });
        
        // Draw text indicating empty
        page.drawText("Empty", {
          x: x + placeholderWidth / 2 - 15,
          y: y + placeholderHeight / 2,
          size: 12,
          font: helveticaFont,
          color: rgb(0.5, 0.5, 0.5)
        });
        
        continue;
      }
      
      const jobData = validJobPDFs[positionIndex];
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
        if (jobPdfDoc.getPageCount() > 0) {
          const [jobFirstPage] = await pdfDoc.embedPdf(jobPdfDoc, [0]);
          
          // Calculate scaling to fit the card area while preserving aspect ratio
          const originalWidth = jobFirstPage.width;
          const originalHeight = jobFirstPage.height;
          
          // Leave space for text at bottom (6mm height)
          const textAreaHeight = mmToPoints(6);
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
      // Draw semitransparent white background for text area
      page.drawRectangle({
        x,
        y,
        width: placeholderWidth,
        height: mmToPoints(6),
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
  }
  
  // Add batch info at the top of the sheet
  const laminationType = jobs[0]?.lamination_type || 'none';
  const formattedLamination = laminationType.charAt(0).toUpperCase() + laminationType.slice(1);
  
  page.drawText(`Business Card Imposition Sheet - ${formattedLamination} Lamination`, {
    x: mmToPoints(10),
    y: pageHeight - mmToPoints(10),
    size: 12,
    font: helveticaBold,
    color: rgb(0, 0, 0)
  });
  
  const totalCards = jobs.reduce((sum, job) => sum + job.quantity, 0);
  
  page.drawText(`Total Jobs: ${jobs.length} | Total Cards: ${totalCards} | Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, {
    x: mmToPoints(10),
    y: pageHeight - mmToPoints(20),
    size: 10,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  });
  
  // Serialize the PDFDocument to bytes
  return await pdfDoc.save();
}
