
import { Job } from "@/components/business-cards/JobsTable";
import { loadPdfAsBytes, createEmptyPdfBytes } from "./pdfLoaderCore";

// Simple structure to represent a slot on the imposition sheet
export interface ImpositionSlot {
  jobId: string;
  jobName: string;
  pdfBytes: ArrayBuffer;
  pageIndex: number;
  quantity: number;
  position: number;
  isBack: boolean;
}

// Assign jobs to slots in a simple, sequential manner
export async function assignJobsToSlots(
  jobs: Job[],
  slotsPerSheet: number = 24
): Promise<{
  frontSlots: ImpositionSlot[];
  backSlots: ImpositionSlot[];
}> {
  console.log(`Assigning ${jobs.length} jobs to imposition slots`);
  
  const frontSlots: ImpositionSlot[] = [];
  const backSlots: ImpositionSlot[] = [];
  
  // First, load all PDFs as bytes
  const jobPdfData = new Map<string, { buffer: ArrayBuffer, pageCount: number }>();
  
  for (const job of jobs) {
    if (!job.id) continue;
    
    // Load the PDF as bytes
    if (job.pdf_url) {
      const pdfData = await loadPdfAsBytes(job.pdf_url, job.id);
      if (pdfData) {
        jobPdfData.set(job.id, pdfData);
      } else {
        // Create empty PDF for failed loads
        const errorBytes = await createEmptyPdfBytes(`Error: ${job.name || "Unknown job"}`);
        jobPdfData.set(job.id, { buffer: errorBytes, pageCount: 1 });
      }
    } else {
      // Create empty PDF for jobs without URL
      const emptyBytes = await createEmptyPdfBytes(`No PDF: ${job.name || "Unknown job"}`);
      jobPdfData.set(job.id, { buffer: emptyBytes, pageCount: 1 });
    }
  }
  
  console.log(`Loaded PDF data for ${jobPdfData.size} jobs`);
  
  // Simple counter for position tracking
  let currentPosition = 0;
  
  // Process jobs one by one
  for (const job of jobs) {
    if (!job.id || !jobPdfData.has(job.id)) continue;
    
    const pdfData = jobPdfData.get(job.id)!;
    const quantity = Math.max(1, job.quantity || 1);
    
    console.log(`Processing job ${job.id} (${job.name}): Quantity ${quantity}, Pages: ${pdfData.pageCount}`);
    
    // Add copies based on quantity
    for (let i = 0; i < quantity && currentPosition < slotsPerSheet; i++) {
      // Track which copy we're placing
      const copyNum = i + 1;
      console.log(`Adding copy ${copyNum}/${quantity} of job ${job.id} at position ${currentPosition}`);
      
      // Add front slot
      frontSlots.push({
        jobId: job.id,
        jobName: job.name || "Unknown Job",
        pdfBytes: pdfData.buffer,
        pageIndex: 0, // Front is always page 0
        quantity: quantity,
        position: currentPosition,
        isBack: false
      });
      
      // Add back side if double-sided
      if (job.double_sided) {
        // Calculate back position with proper mirroring
        const backPosition = calculateBackPosition(currentPosition, slotsPerSheet);
        
        backSlots.push({
          jobId: job.id,
          jobName: job.name || "Unknown Job",
          pdfBytes: pdfData.buffer,
          pageIndex: pdfData.pageCount > 1 ? 1 : 0, // Use page 1 if it exists, otherwise repeat page 0
          quantity: quantity,
          position: backPosition,
          isBack: true
        });
      }
      
      // Move to next position
      currentPosition++;
      if (currentPosition >= slotsPerSheet) {
        console.log(`Reached maximum slots (${slotsPerSheet})`);
        break;
      }
    }
  }
  
  // Sort by position for consistent rendering
  frontSlots.sort((a, b) => a.position - b.position);
  backSlots.sort((a, b) => a.position - b.position);
  
  return { frontSlots, backSlots };
}

// Calculate the corresponding position on the back side
function calculateBackPosition(frontPosition: number, slotsPerSheet: number): number {
  const columns = 3;
  const row = Math.floor(frontPosition / columns);
  const col = frontPosition % columns;
  
  // Mirror column position for back side
  const mirroredCol = columns - 1 - col;
  const backPosition = (row * columns) + mirroredCol;
  
  return backPosition;
}
