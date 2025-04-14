
import { Job } from "@/components/business-cards/JobsTable";
import { rgb } from "pdf-lib";
import { format } from "date-fns";

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
  // Draw black highlight background for text area
  page.drawRectangle({
    x,
    y,
    width: placeholderWidth,
    height: textAreaHeight,
    color: rgb(0, 0, 0),
  });
  
  // Draw job name (truncated if necessary)
  let jobName = job.name;
  if (jobName.length > 15) {
    jobName = jobName.substring(0, 12) + "...";
  }
  
  // Draw job name in white text for better contrast
  page.drawText(jobName, {
    x: x + 2,
    y: y + mmToPoints(3),
    size: 7,
    font: helveticaBold,
    color: rgb(1, 1, 1) // White text
  });
  
  // Make sure job.id is defined before using it
  const jobId = job.id ? job.id.substring(0, 8) : "unknown";
  const dueDate = job.due_date ? format(new Date(job.due_date), 'MMM dd') : "unknown";
  
  // Draw job ID and quantity info with null checks
  const infoText = `ID: ${jobId} | Qty: ${job.quantity || 0} | Due: ${dueDate}`;
  page.drawText(infoText, {
    x: x + placeholderWidth - 85,
    y: y + mmToPoints(3),
    size: 6,
    font: helveticaFont,
    color: rgb(1, 1, 1) // White text
  });
}

// Import mmToPoints for use in this file
import { mmToPoints } from "./pdfUnitHelpers";
