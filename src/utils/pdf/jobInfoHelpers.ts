
import { Job } from "@/components/business-cards/JobsTable";
import { rgb } from "pdf-lib";
import { format } from "date-fns";
import { mmToPoints } from "./pdfUnitHelpers";

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
        y: y + textAreaHeight/2,
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
    if (jobName.length > 12) { // Shortened from 15 to 12 chars to prevent overflow
      jobName = jobName.substring(0, 9) + "...";
    }
    
    // Draw job name in white text for better contrast - FIXED Y POSITIONING
    page.drawText(jobName, {
      x: x + 2,
      y: y + textAreaHeight/2 + 1, // Slightly higher position
      size: 7,
      font: helveticaBold,
      color: rgb(1, 1, 1) // White text
    });
    
    // Make sure job properties are defined before using them
    const jobId = job.id ? job.id.substring(0, 6) : "unknown"; // Shortened from 8 to 6 chars
    
    let dueDate = "unknown";
    try {
      if (job.due_date) {
        dueDate = format(new Date(job.due_date), 'MM/dd'); // Changed format from 'MMM dd' to 'MM/dd' for brevity
      }
    } catch (error) {
      console.error("Error formatting date:", error);
    }
    
    // Better positioning and spacing of job info elements
    page.drawText(`ID:${jobId}`, { // Removed space after colon
      x: x + placeholderWidth - 90, // Adjusted positioning
      y: y + textAreaHeight/2 + 1,
      size: 6,
      font: helveticaFont,
      color: rgb(1, 1, 1) // White text
    });
    
    // Draw quantity separately with more space
    page.drawText(`Qty:${job.quantity || 0}`, { // Removed space after colon
      x: x + placeholderWidth - 55, // Adjusted positioning
      y: y + textAreaHeight/2 + 1,
      size: 6,
      font: helveticaFont,
      color: rgb(1, 1, 1) // White text
    });
    
    // Draw due date separately with more space
    page.drawText(`Due:${dueDate}`, { // Removed space after colon
      x: x + placeholderWidth - 25, // Adjusted positioning
      y: y + textAreaHeight/2 + 1,
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
        y: y + textAreaHeight/2,
        size: 6,
        font: helveticaFont,
        color: rgb(1, 1, 1) // White text
      });
    } catch (drawError) {
      console.error("Failed to draw error message:", drawError);
    }
  }
}
