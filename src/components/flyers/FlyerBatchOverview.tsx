
import { useState, useEffect } from 'react';
import { BaseJob } from '@/config/productTypes';
import { Button } from '@/components/ui/button';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { generateBatchOverview } from '@/utils/batchGeneration';
import { isSleeveJobs } from '@/utils/pdf/jobTypeUtils';

interface FlyerBatchOverviewProps {
  jobs: BaseJob[];
  batchName: string;
}

export const FlyerBatchOverview = ({ jobs, batchName }: FlyerBatchOverviewProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [overviewUrl, setOverviewUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Determine if we're working with sleeve jobs
  const isSleeveJobsType = isSleeveJobs(jobs);
  
  // Generate the batch overview PDF when component mounts
  useEffect(() => {
    if (jobs.length > 0) {
      generateOverview();
    }
  }, [jobs.length]); // Only regenerate when job count changes

  const generateOverview = async () => {
    if (jobs.length === 0) {
      toast.error("No jobs available to generate overview");
      return;
    }

    try {
      setIsGenerating(true);
      setOverviewUrl(null);
      setGenerationError(null);
      
      console.log("FlyerBatchOverview - Generating overview for jobs:", jobs.length);

      // Generate the single-page batch overview with cache-busting
      const timestamp = Date.now();
      const pdfBytes = await generateBatchOverview(jobs, batchName);
      
      // Convert PDF to a data URL for preview
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setOverviewUrl(url);
      
      console.log("FlyerBatchOverview - Overview generated successfully");
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
    
    const timestamp = Date.now();
    const link = document.createElement("a");
    link.href = overviewUrl;
    link.download = `${batchName}-overview-${timestamp}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Determine title based on job type
  const titleText = isSleeveJobsType ? "Sleeve Batch Overview" : "Flyer Batch Overview";

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">{titleText}</h3>
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
          <p className="text-sm text-gray-500">Generating flyer batch overview...</p>
        </div>
      ) : overviewUrl ? (
        <div className="border rounded-md overflow-hidden">
          <iframe 
            src={`${overviewUrl}#toolbar=0`}
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
