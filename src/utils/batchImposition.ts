
import { Job } from "@/components/business-cards/JobsTable";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// Import our streamlined helpers
import { mmToPoints } from "./pdf/pdfUnitHelpers";
import { assignJobsToSlots } from "./pdf/slotAssignment";
import { calculateGridDimensions, drawImpositionGrid } from "./pdf/impositionGrid";

// Simplified imposition sheet generator
export async function generateImpositionSheet(jobs: Job[], batchName: string = ""): Promise<Uint8Array> {
  console.log("-------------------------");
  console.log("STARTING NEW IMPOSITION SHEET GENERATION");
  console.log("Jobs: ", jobs.length, "Batch Name:", batchName);
  console.log("-------------------------");
  
  try {
    // Validate input
    if (!jobs || jobs.length === 0) {
      console.error("No jobs provided for imposition sheet generation");
      throw new Error("No jobs provided for imposition sheet generation");
    }
    
    // Use provided batch name or generate default
    const actualBatchName = batchName || generateDefaultBatchName();
    
    // Step 1: Assign jobs to slots
    console.log("Assigning jobs to slots...");
    const { frontSlots, backSlots } = await assignJobsToSlots(jobs, 24);
    console.log(`Created slot assignments - Front: ${frontSlots.length}, Back: ${backSlots.length}`);
    
    // Step 2: Create the PDF document
    console.log("Creating new PDF document...");
    const pdfDoc = await PDFDocument.create();
    
    // Set custom page dimensions (320mm x 455mm)
    const pageWidth = mmToPoints(320);
    const pageHeight = mmToPoints(455);
    
    // Calculate grid dimensions
    const gridDimensions = calculateGridDimensions(pageWidth, pageHeight);
    
    // Step 3: Create front page
    console.log("Creating front page...");
    const frontPage = pdfDoc.addPage([pageWidth, pageHeight]);
    await drawImpositionGrid(
      pdfDoc, 
      frontPage, 
      frontSlots, 
      gridDimensions, 
      "Front", 
      actualBatchName
    );
    
    // Step 4: Create back page if needed
    if (backSlots.length > 0) {
      console.log("Creating back page...");
      const backPage = pdfDoc.addPage([pageWidth, pageHeight]);
      await drawImpositionGrid(
        pdfDoc, 
        backPage, 
        backSlots, 
        gridDimensions, 
        "Back", 
        actualBatchName
      );
    }
    
    // Step 5: Save PDF
    console.log("Saving PDF document...");
    return await pdfDoc.save();
    
  } catch (error) {
    console.error("Error generating imposition sheet:", error);
    
    // Create error PDF as fallback
    try {
      const errorPdf = await PDFDocument.create();
      const errorPage = errorPdf.addPage([mmToPoints(320), mmToPoints(455)]);
      const font = await errorPdf.embedFont(StandardFonts.HelveticaBold);
      
      errorPage.drawText("Error Generating Imposition Sheet", {
        x: 50,
        y: errorPage.getHeight() - 50,
        size: 24,
        font
      });
      
      errorPage.drawText(`Error: ${error instanceof Error ? error.message : "Unknown error"}`, {
        x: 50,
        y: errorPage.getHeight() - 100,
        size: 12,
        font,
        color: rgb(0.8, 0, 0)
      });
      
      return await errorPdf.save();
    } catch (fallbackError) {
      console.error("Error creating fallback error PDF:", fallbackError);
      throw error;
    }
  }
}

// Helper function for default batch name
function generateDefaultBatchName(): string {
  const today = new Date();
  const year = today.getFullYear().toString().slice(2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `DXB-BC-${year}${month}${day}`;
}
