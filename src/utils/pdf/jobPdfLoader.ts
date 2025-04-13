
import { PDFDocument } from "pdf-lib";
import { Job } from "@/components/business-cards/JobsTable";

// Load all job PDFs
export async function loadJobPDFs(jobs: Job[]) {
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
  return jobPDFs.filter(item => item !== null) as { job: Job; pdfDoc: PDFDocument }[];
}
