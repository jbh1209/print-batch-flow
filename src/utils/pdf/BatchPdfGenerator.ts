
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";
import { mmToPoints } from "./pdfUnitHelpers";
import calculateJobPageDistribution from "./JobPageDistributor";
import { processJobPdfs } from "./PdfPageProcessor";
import { createImpositionSlots, calculateSheetDimensions, createImpositionSheet } from "./ImpositionEngine";

/**
 * Main function to generate imposition sheets for a batch of jobs
 */
export async function generateBatchImposition(
  jobs: Job[],
  batchName: string
): Promise<Uint8Array> {
  console.log("-------------------------");
  console.log("STARTING BATCH IMPOSITION");
  console.log(`Jobs: ${jobs.length}, Batch Name: ${batchName}`);
  console.log("-------------------------");
  
  try {
    // Validate input
    if (!jobs || jobs.length === 0) {
      console.error("No jobs provided for imposition");
      throw new Error("No jobs provided for imposition");
    }
    
    // Step 1: Calculate job slot distribution
    const TOTAL_SLOTS = 24; // 3x8 grid
    const jobAllocations = calculateJobPageDistribution(jobs, TOTAL_SLOTS);
    
    // Create map for quantity lookup
    const quantityMap = new Map(
      jobAllocations.map(job => [job.jobId, job.quantityPerSlot])
    );
    
    // Step 2: Process PDFs - extract and duplicate pages as needed
    const slotRequirements = jobAllocations.map(job => ({
      jobId: job.jobId,
      slotsNeeded: job.slotsNeeded,
      isDoubleSided: job.isDoubleSided
    }));
    
    const processedJobPages = await processJobPdfs(jobs, slotRequirements);
    
    // Step 3: Assign processed pages to slots
    const { frontSlots, backSlots } = createImpositionSlots(processedJobPages, quantityMap);
    
    // Step 4: Create imposition sheets
    // Define custom page dimensions (320mm x 455mm)
    const pageWidth = mmToPoints(320);
    const pageHeight = mmToPoints(455);
    
    // Calculate grid dimensions for the sheet
    const sheetDimensions = calculateSheetDimensions(pageWidth, pageHeight);
    
    console.log("Creating front imposition sheet...");
    const frontSheet = await createImpositionSheet(
      frontSlots,
      sheetDimensions,
      "Front",
      batchName
    );
    
    // Create final PDF document
    const finalPdf = await PDFDocument.create();
    
    // Add front sheet
    const [frontPage] = await finalPdf.copyPages(frontSheet, [0]);
    finalPdf.addPage(frontPage);
    
    // Add back sheet if we have back slots
    if (backSlots.length > 0) {
      console.log("Creating back imposition sheet...");
      const backSheet = await createImpositionSheet(
        backSlots,
        sheetDimensions,
        "Back",
        batchName
      );
      
      const [backPage] = await finalPdf.copyPages(backSheet, [0]);
      finalPdf.addPage(backPage);
    }
    
    console.log("Finalizing PDF document...");
    return await finalPdf.save();
    
  } catch (error) {
    console.error("Error generating imposition sheets:", error);
    
    // Create error PDF as fallback
    const errorPdf = await PDFDocument.create();
    const errorPage = errorPdf.addPage([mmToPoints(320), mmToPoints(455)]);
    
    errorPage.drawText("Error Generating Imposition Sheet", {
      x: 50,
      y: errorPage.getHeight() - 50,
      size: 24
    });
    
    errorPage.drawText(`Error: ${error instanceof Error ? error.message : "Unknown error"}`, {
      x: 50,
      y: errorPage.getHeight() - 100,
      size: 12
    });
    
    return await errorPdf.save();
  }
}
