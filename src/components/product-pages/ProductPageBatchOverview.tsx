
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { generateBatchOverview } from '@/utils/batchGeneration';
import { ProductPageJob } from './types/ProductPageTypes';

interface ProductPageBatchOverviewProps {
  jobs: ProductPageJob[];
  batchName: string;
}

export const ProductPageBatchOverview = ({ jobs, batchName }: ProductPageBatchOverviewProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [overviewUrl, setOverviewUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  // Log job information to help debug the issue
  useEffect(() => {
    if (jobs.length > 0) {
      console.log('Jobs being passed to batch overview:', 
        jobs.map(job => ({ 
          id: job.id, 
          job_number: job.job_number || 'No job number', 
          name: job.name 
        }))
      );
      generateOverview();
    }
  }, []);  // Only run on mount, not on every jobs change

  const generateOverview = async () => {
    if (jobs.length === 0) {
      toast.error("No jobs available to generate overview");
      return;
    }

    try {
      setIsGenerating(true);
      setOverviewUrl(null);
      setGenerationError(null);
      
      // Show a toast that we're working on it
      const toastId = toast.loading("Generating batch overview...");

      // Generate the single-page batch overview
      const pdfBytes = await generateBatchOverview(jobs, batchName);
      
      // Convert PDF to a data URL for preview
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setOverviewUrl(url);
      
      // Dismiss the loading toast and show success
      toast.dismiss(toastId);
      toast.success("Batch overview generated successfully");
    } catch (error) {
      console.error("Error generating batch overview:", error);
      setGenerationError("Failed to generate overview. Please try again.");
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
        <h3 className="text-lg font-medium">Product Page Batch Overview</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateOverview}
            disabled={isGenerating || jobs.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Regenerate'}
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
      ) : generationError ? (
        <div className="border rounded-md p-8 flex flex-col items-center justify-center bg-gray-50 text-destructive">
          <FileText className="h-10 w-10 mb-2" />
          <p className="text-sm mb-2">{generationError}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateOverview}
          >
            Try Again
          </Button>
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
