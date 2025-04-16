
import { useState, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { Button } from '@/components/ui/button';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getSignedUrl } from '@/utils/pdf/signedUrlHelper';

interface FlyerBatchOverviewProps {
  jobs: FlyerJob[];
  batchName: string;
}

export const FlyerBatchOverview = ({ jobs, batchName }: FlyerBatchOverviewProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [overviewUrl, setOverviewUrl] = useState<string | null>(null);

  // Generate the batch overview PDF when jobs change
  useEffect(() => {
    if (jobs.length > 0) {
      generateOverview();
    }
  }, [jobs]);

  const generateOverview = async () => {
    if (jobs.length === 0) {
      toast.error("No jobs available to generate overview");
      return;
    }

    try {
      setIsGenerating(true);
      setOverviewUrl(null);
      toast.loading("Generating batch overview...");

      // Create a new PDF document
      const mergedPdf = await PDFDocument.create();
      
      // Add a cover page with batch information
      const coverPage = mergedPdf.addPage([595, 842]); // A4 size
      
      // Add batch name and job information
      coverPage.drawText(`Batch Overview: ${batchName}`, {
        x: 50,
        y: 800,
        size: 24
      });
      
      coverPage.drawText(`Total Jobs: ${jobs.length}`, {
        x: 50,
        y: 750,
        size: 14
      });
      
      coverPage.drawText(`Generated: ${new Date().toLocaleString()}`, {
        x: 50,
        y: 730,
        size: 12
      });
      
      // Add job details
      coverPage.drawText('Jobs in this batch:', {
        x: 50,
        y: 680,
        size: 16
      });
      
      let yPosition = 650;
      for (const job of jobs) {
        coverPage.drawText(`• ${job.name} (${job.job_number}) - ${job.size}, ${job.quantity} pcs`, {
          x: 70,
          y: yPosition,
          size: 12
        });
        yPosition -= 20;
      }
      
      // For each job, add preview pages from its PDF
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        
        if (!job.pdf_url) {
          console.warn(`Job ${job.id} has no PDF URL`);
          continue;
        }
        
        // Add a separator page for the job
        const separatorPage = mergedPdf.addPage([595, 842]);
        separatorPage.drawText(`Job: ${job.name}`, {
          x: 50,
          y: 800,
          size: 20
        });
        
        separatorPage.drawText(`Job Number: ${job.job_number}`, {
          x: 50,
          y: 770,
          size: 14
        });
        
        separatorPage.drawText(`Size: ${job.size}, Quantity: ${job.quantity}`, {
          x: 50,
          y: 750,
          size: 12
        });
        
        separatorPage.drawText(`Paper: ${job.paper_weight} ${job.paper_type}`, {
          x: 50,
          y: 730,
          size: 12
        });
        
        // Try to embed the job PDF
        try {
          const signedUrl = await getSignedUrl(job.pdf_url);
          if (!signedUrl) {
            console.error(`Failed to get signed URL for job ${job.id}`);
            continue;
          }
          
          const response = await fetch(signedUrl);
          if (!response.ok) {
            console.error(`Failed to fetch PDF for job ${job.id}: ${response.status}`);
            continue;
          }
          
          const jobPdfBytes = await response.arrayBuffer();
          const jobPdf = await PDFDocument.load(jobPdfBytes);
          
          // Only add first page as preview
          const [firstPage] = await mergedPdf.copyPages(jobPdf, [0]);
          mergedPdf.addPage(firstPage);
        } catch (error) {
          console.error(`Error processing PDF for job ${job.id}:`, error);
          
          // Add an error page instead
          const errorPage = mergedPdf.addPage([595, 842]);
          errorPage.drawText(`Error loading PDF for job ${job.name}`, {
            x: 50,
            y: 800,
            size: 16
          });
          
          errorPage.drawText(`Error: ${error instanceof Error ? error.message : "Unknown error"}`, {
            x: 50,
            y: 750,
            size: 12
          });
        }
      }
      
      // Convert PDF to a data URL for preview
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setOverviewUrl(url);
      
      toast.success("Batch overview generated successfully");
    } catch (error) {
      console.error("Error generating batch overview:", error);
      toast.error("Failed to generate batch overview");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadOverview = () => {
    if (!overviewUrl) return;
    
    const link = document.createElement("a");
    link.href = overviewUrl;
    link.download = `${batchName}-overview.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Batch Overview</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateOverview}
            disabled={isGenerating || jobs.length === 0}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={downloadOverview}
            disabled={!overviewUrl}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {isGenerating ? (
        <div className="border rounded-md p-8 flex flex-col items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-2"></div>
          <p className="text-sm text-gray-500">Generating overview...</p>
        </div>
      ) : overviewUrl ? (
        <div className="border rounded-md overflow-hidden">
          <iframe 
            src={overviewUrl} 
            className="w-full h-[500px]" 
            title={`${batchName} Overview`}
          />
        </div>
      ) : (
        <div className="border rounded-md p-8 flex flex-col items-center justify-center bg-gray-50">
          <FileText className="h-10 w-10 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">
            {jobs.length === 0 
              ? "No jobs available to generate overview" 
              : "Click 'Regenerate' to create batch overview"
            }
          </p>
        </div>
      )}
    </div>
  );
};
