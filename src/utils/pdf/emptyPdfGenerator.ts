
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";

// Create an empty PDF for cases where a job has no valid PDF
export async function createEmptyPdf(job: Job): Promise<PDFDocument> {
  console.log(`Creating empty PDF for job ${job.id || "unknown"} (missing PDF URL)`);
  const emptyPdf = await PDFDocument.create();
  const page = emptyPdf.addPage([350, 200]);
  
  page.drawText(`No PDF available for job: ${job.name || job.id}`, {
    x: 50,
    y: 100,
    size: 12
  });
  
  return emptyPdf;
}

// Create a fallback PDF with a custom error message
export async function createErrorPdf(job: Job, errorMessage: string): Promise<PDFDocument> {
  const fallbackPdf = await PDFDocument.create();
  const page = fallbackPdf.addPage([350, 200]);
  
  page.drawText(`Error loading PDF for: ${job.name || job.id}`, {
    x: 50,
    y: 120,
    size: 12
  });
  
  page.drawText(errorMessage, {
    x: 50,
    y: 80,
    size: 10
  });
  
  return fallbackPdf;
}
