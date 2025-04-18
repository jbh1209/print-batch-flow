
import { useState, useEffect } from 'react';
import { FlyerJob } from '@/components/batches/types/FlyerTypes';
import { Button } from '@/components/ui/button';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { generateBatchOverview } from '@/utils/batchGeneration';

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

      // Generate the single-page batch overview
      const pdfBytes = await generateBatchOverview(jobs, batchName);
      
      // Convert PDF to a data URL for preview
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
