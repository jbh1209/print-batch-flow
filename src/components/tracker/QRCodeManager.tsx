
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCode, Printer, Download, Copy, Share, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QRCodeLabel } from "./QRCodeLabel";
import { generateQRCodeData, generateQRCodeImage } from "@/utils/qrCodeGenerator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionJob {
  id: string;
  wo_no: string;
  customer?: string;
  due_date?: string;
  status?: string;
  qr_code_data?: string;
  qr_code_url?: string;
}

interface QRCodeManagerProps {
  job: ProductionJob;
  onQRCodeGenerated?: (qrData: string, qrUrl: string) => void;
  compact?: boolean;
}

export const QRCodeManager = ({ job, onQRCodeGenerated, compact = false }: QRCodeManagerProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(job.qr_code_url || null);

  const generateQRCode = async () => {
    setIsGenerating(true);
    try {
      const qrData = generateQRCodeData({
        wo_no: job.wo_no,
        job_id: job.id,
        customer: job.customer,
        due_date: job.due_date
      });

      const qrUrl = await generateQRCodeImage(qrData);
      setQrCodeDataURL(qrUrl);

      // Save to database
      const { error } = await supabase
        .from('production_jobs')
        .update({
          qr_code_data: qrData,
          qr_code_url: qrUrl
        })
        .eq('id', job.id);

      if (error) {
        throw error;
      }

      onQRCodeGenerated?.(qrData, qrUrl);
      toast.success("QR code generated successfully");
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyQRData = async () => {
    if (job.qr_code_data) {
      await navigator.clipboard.writeText(job.qr_code_data);
      toast.success("QR data copied to clipboard");
    }
  };

  const shareQRCode = async () => {
    if (qrCodeDataURL && navigator.share) {
      try {
        // Convert data URL to blob for sharing
        const response = await fetch(qrCodeDataURL);
        const blob = await response.blob();
        const file = new File([blob], `qr-${job.wo_no}.png`, { type: 'image/png' });
        
        await navigator.share({
          title: `QR Code - ${job.wo_no}`,
          text: `QR code for work order ${job.wo_no}`,
          files: [file]
        });
      } catch (error) {
        console.error('Error sharing:', error);
        toast.error("Sharing not supported on this device");
      }
    } else {
      toast.error("QR code not available or sharing not supported");
    }
  };

  const printLabel = () => {
    if (!qrCodeDataURL) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Label - ${job.wo_no}</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
            body { 
              margin: 0; 
              padding: 10px; 
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .label-container {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            ${document.querySelector(`[data-label="${job.id}"]`)?.innerHTML || ''}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
  };

  const downloadLabel = () => {
    if (!qrCodeDataURL) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for 100mm x 50mm at 300 DPI
    canvas.width = 1181;
    canvas.height = 591;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      // Draw QR code
      const qrSize = 350;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = 100;
      ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

      // Draw text
      ctx.fillStyle = 'black';
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`WO: ${job.wo_no}`, canvas.width / 2, 80);

      if (job.customer) {
        ctx.font = '32px Arial';
        ctx.fillText(job.customer, canvas.width / 2, 480);
      }

      if (job.due_date) {
        ctx.font = '28px Arial';
        ctx.fillText(`Due: ${new Date(job.due_date).toLocaleDateString()}`, canvas.width / 2, 520);
      }

      // Add status badge
      if (job.status) {
        ctx.font = '24px Arial';
        ctx.fillText(`Status: ${job.status}`, canvas.width / 2, 560);
      }

      // Download
      const link = document.createElement('a');
      link.download = `qr-label-${job.wo_no}.png`;
      link.href = canvas.toDataURL();
      link.click();
    };
    img.src = qrCodeDataURL;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {qrCodeDataURL ? (
          <>
            <Button 
              variant="outline" 
              size="sm"
              onClick={copyQRData}
              className="h-7 px-2"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={shareQRCode}
              className="h-7 px-2"
            >
              <Share className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <Button 
            variant="outline" 
            size="sm"
            onClick={generateQRCode}
            disabled={isGenerating}
            className="h-7 px-2"
          >
            <QrCode className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          {qrCodeDataURL ? 'QR Code' : 'Generate QR'}
          {qrCodeDataURL && <Badge variant="secondary" className="ml-1">Ready</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code Manager - {job.wo_no}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!qrCodeDataURL ? (
            <div className="text-center space-y-4">
              <div className="text-gray-600">
                Generate a QR code for this job to enable mobile workflow tracking
              </div>
              <Button 
                onClick={generateQRCode} 
                disabled={isGenerating}
                className="flex items-center gap-2"
                size="lg"
              >
                <QrCode className="h-5 w-5" />
                {isGenerating ? "Generating..." : "Generate QR Code"}
              </Button>
            </div>
          ) : (
            <>
              <div 
                data-label={job.id}
                className="flex justify-center border rounded p-4 bg-white"
              >
                <QRCodeLabel
                  woNo={job.wo_no}
                  qrCodeDataURL={qrCodeDataURL}
                  customer={job.customer}
                  dueDate={job.due_date}
                  status={job.status}
                />
              </div>
              
              {/* Mobile-friendly actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={copyQRData}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copy Data
                </Button>
                <Button 
                  onClick={shareQRCode}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Share className="h-4 w-4" />
                  Share
                </Button>
                <Button 
                  onClick={printLabel}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button 
                  onClick={downloadLabel}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </div>

              {/* Mobile workflow info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Mobile Workflow</span>
                </div>
                <div className="text-sm text-blue-700">
                  <p>Scan this QR code with the mobile app to:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Start and complete production stages</li>
                    <li>Add stage notes and timing</li>
                    <li>Track real-time progress</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-center">
                <Button 
                  onClick={generateQRCode}
                  variant="ghost"
                  size="sm"
                  disabled={isGenerating}
                >
                  Regenerate QR Code
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
