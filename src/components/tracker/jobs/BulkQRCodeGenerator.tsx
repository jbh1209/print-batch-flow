
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QrCode, Download, CheckCircle, AlertCircle } from "lucide-react";
import { generateQRCodeData, generateQRCodeImage } from "@/utils/qrCodeGenerator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkQRCodeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedJobs: any[];
  onComplete: () => void;
}

interface QRResult {
  jobId: string;
  woNo: string;
  success: boolean;
  qrUrl?: string;
  error?: string;
}

export const BulkQRCodeGenerator: React.FC<BulkQRCodeGeneratorProps> = ({
  isOpen,
  onClose,
  selectedJobs,
  onComplete
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<QRResult[]>([]);
  const [currentJob, setCurrentJob] = useState<string>("");

  const generateQRCodes = async () => {
    if (selectedJobs.length === 0) return;

    setIsGenerating(true);
    setProgress(0);
    setResults([]);
    
    const qrResults: QRResult[] = [];

    for (let i = 0; i < selectedJobs.length; i++) {
      const job = selectedJobs[i];
      setCurrentJob(job.wo_no);
      
      try {
        // Generate QR code data with just the essential info
        const qrData = generateQRCodeData({
          wo_no: job.wo_no,
          job_id: job.id,
          customer: job.customer,
          due_date: job.due_date
        });

        // Generate QR code image
        const qrCodeDataURL = await generateQRCodeImage(qrData);
        
        // Update job with QR code URL
        const { error } = await supabase
          .from('production_jobs')
          .update({ 
            qr_code_url: qrCodeDataURL,
            qr_code_data: qrData,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.id);

        if (error) throw error;

        qrResults.push({
          jobId: job.id,
          woNo: job.wo_no,
          success: true,
          qrUrl: qrCodeDataURL
        });

      } catch (error) {
        console.error(`Error generating QR code for job ${job.wo_no}:`, error);
        qrResults.push({
          jobId: job.id,
          woNo: job.wo_no,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      setProgress(((i + 1) / selectedJobs.length) * 100);
      setResults([...qrResults]);
    }

    setIsGenerating(false);
    setCurrentJob("");
    
    const successCount = qrResults.filter(r => r.success).length;
    const failureCount = qrResults.filter(r => !r.success).length;
    
    if (successCount > 0) {
      toast.success(`Generated ${successCount} QR code${successCount > 1 ? 's' : ''} successfully`);
    }
    
    if (failureCount > 0) {
      toast.error(`Failed to generate ${failureCount} QR code${failureCount > 1 ? 's' : ''}`);
    }
    
    onComplete();
  };

  const downloadAllQRCodes = () => {
    const successfulResults = results.filter(r => r.success && r.qrUrl);
    
    successfulResults.forEach((result, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = result.qrUrl!;
        link.download = `qr-code-${result.woNo}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 100); // Stagger downloads slightly
    });
  };

  const handleClose = () => {
    if (!isGenerating) {
      onClose();
      setResults([]);
      setProgress(0);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Generate QR Codes - {selectedJobs.length} Job{selectedJobs.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!isGenerating && results.length === 0 && (
            <div className="text-center space-y-4">
              <QrCode className="h-16 w-16 mx-auto text-gray-400" />
              <p className="text-gray-600">
                Generate QR codes for {selectedJobs.length} selected work order{selectedJobs.length > 1 ? 's' : ''}
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                {selectedJobs.slice(0, 5).map(job => (
                  <div key={job.id}>{job.wo_no}</div>
                ))}
                {selectedJobs.length > 5 && (
                  <div>... and {selectedJobs.length - 5} more</div>
                )}
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-medium">Generating QR Codes...</p>
                <p className="text-sm text-gray-600">
                  Currently processing: {currentJob}
                </p>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-center text-gray-500">
                {Math.round(progress)}% complete
              </p>
            </div>
          )}

          {!isGenerating && results.length > 0 && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-medium">Generation Complete</p>
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-2">
                {results.map((result) => (
                  <div key={result.jobId} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="flex-1">{result.woNo}</span>
                    {result.success ? (
                      <span className="text-green-600">Success</span>
                    ) : (
                      <span className="text-red-600">Failed</span>
                    )}
                  </div>
                ))}
              </div>

              {results.some(r => r.success) && (
                <Button 
                  onClick={downloadAllQRCodes}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download All QR Codes
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isGenerating}
            className="flex-1"
          >
            {results.length > 0 ? 'Close' : 'Cancel'}
          </Button>
          
          {!isGenerating && results.length === 0 && (
            <Button 
              onClick={generateQRCodes}
              className="flex-1"
            >
              <QrCode className="h-4 w-4 mr-2" />
              Generate QR Codes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
