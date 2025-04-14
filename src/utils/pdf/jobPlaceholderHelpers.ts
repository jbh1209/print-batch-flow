
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { embedJobPDF } from "./jobEmbedHelpers";
import { drawJobInfo } from "./jobInfoHelpers";

// Draw a job placeholder with embedded PDF
export async function drawJobPlaceholder(
  page: any,
  x: number,
  y: number,
  jobData: { job: Job; pdfDoc: PDFDocument; isDuplicated?: boolean },
  placeholderWidth: number,
  placeholderHeight: number,
  textAreaHeight: number,
  helveticaFont: any,
  helveticaBold: any
) {
  const { job, pdfDoc } = jobData;
  
  // Draw placeholder border
  page.drawRectangle({
    x,
    y,
    width: placeholderWidth,
    height: placeholderHeight,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
    color: rgb(1, 1, 1)
  });
  
  // Try to embed the first page of the job PDF
  try {
    await embedJobPDF(
      page, 
      pdfDoc, 
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
