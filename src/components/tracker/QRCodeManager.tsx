
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCode, Printer, Download } from "lucide-react";
import { QRCodeLabel } from "./QRCodeLabel";
import { generateQRCodeData, generateQRCodeImage } from "@/utils/qrCodeGenerator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProductionJob {
  id: string;
  wo_no: string;
  customer?: string;
  due_date?: string;
  qr_code_data?: string;
  qr_code_url?: string;
}

interface QRCodeManagerProps {
  job: ProductionJob;
  onQRCodeGenerated?: (qrData: string, qrUrl: string) => void;
}

export const QRCodeManager = ({ job, onQRCodeGenerated }: QRCodeManagerProps) => {
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
            body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }
          </style>
        </head>
        <body>
          ${document.querySelector(`[data-label="${job.id}"]`)?.innerHTML || ''}
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
    canvas.width = 1181; // 100mm at 300 DPI
    canvas.height = 591; // 50mm at 300 DPI

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw QR code and text
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

      // Download
      const link = document.createElement('a');
      link.download = `qr-label-${job.wo_no}.png`;
      link.href = canvas.toDataURL();
      link.click();
    };
    img.src = qrCodeDataURL;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          {qrCodeDataURL ? 'View QR' : 'Generate QR'}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code Label - {job.wo_no}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!qrCodeDataURL ? (
            <div className="text-center">
              <Button 
                onClick={generateQRCode} 
                disabled={isGenerating}
                className="flex items-center gap-2"
              >
                <QrCode className="h-4 w-4" />
                {isGenerating ? "Generating..." : "Generate QR Code"}
              </Button>
            </div>
          ) : (
            <>
              <div 
                data-label={job.id}
                className="flex justify-center border rounded p-2"
                style={{ transform: 'scale(0.8)', transformOrigin: 'center' }}
              >
                <QRCodeLabel
                  woNo={job.wo_no}
                  qrCodeDataURL={qrCodeDataURL}
                  customer={job.customer}
                  dueDate={job.due_date}
                />
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button 
                  onClick={printLabel}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
                <Button 
                  onClick={downloadLabel}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button 
                  onClick={generateQRCode}
                  variant="outline"
                  size="sm"
                  disabled={isGenerating}
                >
                  Regenerate
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
