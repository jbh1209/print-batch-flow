
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Download, Loader2 } from "lucide-react";
import { generateQRCodeData, generateQRCodeImage } from "@/utils/qrCodeGenerator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QRCodeManagerProps {
  job: any;
  compact?: boolean;
  onQRCodeGenerated?: () => void;
}

export const QRCodeManager: React.FC<QRCodeManagerProps> = ({
  job,
  compact = false,
  onQRCodeGenerated
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(job.qr_code_url);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      // Generate QR code data
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
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (error) throw error;

      setQrCodeUrl(qrCodeDataURL);
      toast.success('QR code generated successfully');
      
      if (onQRCodeGenerated) {
        onQRCodeGenerated();
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrCodeUrl;
      link.download = `qr-code-${job.wo_no}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (compact) {
    return (
      <>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsOpen(true)}
          className="p-1"
        >
          <QrCode className="h-4 w-4" />
        </Button>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code - Job {job.wo_no}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {qrCodeUrl ? (
                <div className="text-center space-y-4">
                  <img 
                    src={qrCodeUrl} 
                    alt={`QR Code for job ${job.wo_no}`}
                    className="mx-auto border rounded"
                  />
                  <Button onClick={downloadQRCode} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-gray-500">No QR code generated yet</p>
                  <Button 
                    onClick={generateQRCode} 
                    disabled={isGenerating}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4 mr-2" />
                    )}
                    {isGenerating ? 'Generating...' : 'Generate QR Code'}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Non-compact version for other uses
  return (
    <div className="space-y-4">
      {qrCodeUrl ? (
        <div className="text-center space-y-4">
          <img 
            src={qrCodeUrl} 
            alt={`QR Code for job ${job.wo_no}`}
            className="mx-auto border rounded"
          />
          <Button onClick={downloadQRCode}>
            <Download className="h-4 w-4 mr-2" />
            Download QR Code
          </Button>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <p className="text-gray-500">No QR code generated yet</p>
          <Button 
            onClick={generateQRCode} 
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4 mr-2" />
            )}
            {isGenerating ? 'Generating...' : 'Generate QR Code'}
          </Button>
        </div>
      )}
    </div>
  );
};
