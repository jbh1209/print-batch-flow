
import { Job } from "@/components/business-cards/JobsTable";
import { rgb } from "pdf-lib";
import { format } from "date-fns";

// Draw job information at the bottom of the placeholder with improved null handling
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
  try {
    // Ensure job object exists
    if (!job) {
      console.error("Null job object provided to drawJobInfo");
      
      // Draw a gray box with "Unknown Job" text
      page.drawRectangle({
        x,
        y,
        width: placeholderWidth,
        height: textAreaHeight,
        color: rgb(0.3, 0.3, 0.3),
      });
      
      page.drawText("Unknown Job", {
        x: x + 2,
        y: y + mmToPoints(3),
        size: 7,
        font: helveticaBold,
        color: rgb(1, 1, 1) // White text
      });
      
      return;
    }
    
    // Draw black highlight background for text area
    page.drawRectangle({
      x,
      y,
      width: placeholderWidth,
      height: textAreaHeight,
      color: rgb(0, 0, 0),
    });
    
    // Get job name with fallback
    let jobName = job.name || "Untitled Job";
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
    
    // Make sure job properties are defined before using them
    const jobId = job.id ? job.id.substring(0, 8) : "unknown";
    
    let dueDate = "unknown";
    try {
      if (job.due_date) {
        dueDate = format(new Date(job.due_date), 'MMM dd');
      }
    } catch (error) {
      console.error("Error formatting date:", error);
    }
    
    // Draw job ID and quantity info with null checks
    const infoText = `ID: ${jobId} | Qty: ${job.quantity || 0} | Due: ${dueDate}`;
    page.drawText(infoText, {
      x: x + placeholderWidth - 85,
      y: y + mmToPoints(3),
      size: 6,
      font: helveticaFont,
      color: rgb(1, 1, 1) // White text
    });
  } catch (error) {
    console.error("Error in drawJobInfo:", error);
    
    // Attempt to draw minimal info on error
    try {
      page.drawRectangle({
        x,
        y,
        width: placeholderWidth,
        height: textAreaHeight,
        color: rgb(0.5, 0, 0),
      });
      
      page.drawText("Error displaying job info", {
        x: x + 2,
        y: y + mmToPoints(3),
        size: 6,
        font: helveticaFont,
        color: rgb(1, 1, 1) // White text
      });
    } catch (drawError) {
      console.error("Failed to draw error message:", drawError);
    }
  }
}

// Import mmToPoints for use in this file
import { mmToPoints } from "./pdfUnitHelpers";
