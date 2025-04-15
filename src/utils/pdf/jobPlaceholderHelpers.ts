
import { PDFDocument, rgb } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";

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
  const { job } = jobData;
  
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
  
  // Draw error message
  page.drawText("PDF Placeholder", {
    x: x + placeholderWidth / 2 - 40,
    y: y + placeholderHeight / 2,
    size: 10,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5)
  });
  
  // Draw job info at the bottom
  drawSimpleJobInfo(page, job, x, y, placeholderWidth, textAreaHeight, helveticaFont, helveticaBold);
}

// Draw simple job info for legacy support
function drawSimpleJobInfo(
  page: any, 
  job: Job, 
  x: number, 
  y: number, 
  placeholderWidth: number, 
  textAreaHeight: number,
  helveticaFont: any,
  helveticaBold: any
) {
  // Draw black background for text area
  page.drawRectangle({
    x,
    y,
    width: placeholderWidth,
    height: textAreaHeight,
    color: rgb(0, 0, 0),
  });
  
  // Format job name
  let jobName = job.name || "Untitled Job";
  if (jobName.length > 12) {
    jobName = jobName.substring(0, 9) + "...";
  }
  
  // Draw job name
  page.drawText(jobName, {
    x: x + 12,
    y: y + textAreaHeight/2 + 1,
    size: 7,
    font: helveticaBold,
    color: rgb(1, 1, 1) // White text
  });
  
  // Draw job ID
  const jobId = job.id ? job.id.substring(0, 6) : "unknown";
  page.drawText(`ID:${jobId}`, {
    x: x + placeholderWidth - 115,
    y: y + textAreaHeight/2 + 1,
    size: 6,
    font: helveticaFont,
    color: rgb(1, 1, 1)
  });
  
  // Draw quantity
  page.drawText(`Qty:${job.quantity || 0}`, {
    x: x + placeholderWidth - 75,
    y: y + textAreaHeight/2 + 1,
    size: 6,
    font: helveticaFont,
    color: rgb(1, 1, 1)
  });
  
  // Draw front indicator
  page.drawText("Front", {
    x: x + placeholderWidth - 38,
    y: y + textAreaHeight/2 + 1,
    size: 6,
    font: helveticaFont,
    color: rgb(1, 1, 1)
  });
}
