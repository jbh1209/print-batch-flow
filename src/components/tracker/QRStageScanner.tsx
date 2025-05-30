
import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QrCode, Scan, Camera, Type, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseQRCodeData } from "@/utils/qrCodeGenerator";
import { toast } from "sonner";

interface QRStageScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (stageId: string, qrData: any, notes?: string) => void;
  stage?: {
    id: string;
    production_stage: {
      name: string;
      color: string;
    };
    stage_order: number;
  } | null;
  mode: 'start' | 'complete';
}

export const QRStageScanner: React.FC<QRStageScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  stage,
  mode
}) => {
  const [qrCode, setQrCode] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanMethod, setScanMethod] = useState<'manual' | 'camera'>('manual');
  const [parsedData, setParsedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleQRCodeChange = (value: string) => {
    setQrCode(value);
    
    // Try to parse QR data if it looks like JSON
    if (value.trim()) {
      const parsed = parseQRCodeData(value);
      if (parsed) {
        setParsedData(parsed);
        toast.success("QR code data validated");
      } else {
        setParsedData(null);
      }
    } else {
      setParsedData(null);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real implementation, you would use a QR code reading library here
      // For now, we'll show a placeholder
      toast.info("QR code image scanning not yet implemented - please enter manually");
    }
  };

  const handleScan = async () => {
    if (!stage || !qrCode.trim()) return;

    setIsProcessing(true);
    try {
      const qrData = {
        qr_code: qrCode,
        scan_time: new Date().toISOString(),
        mode,
        stage_id: stage.id,
        parsed_data: parsedData,
        scan_method: scanMethod
      };

      await onScan(stage.id, qrData, notes || undefined);
      
      // Reset form
      setQrCode('');
      setNotes('');
      setParsedData(null);
      onClose();
    } catch (error) {
      console.error('Error processing QR scan:', error);
      toast.error('Failed to process QR scan');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setQrCode('');
    setNotes('');
    setParsedData(null);
    onClose();
  };

  if (!stage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            QR Code Scanner
          </DialogTitle>
          <DialogDescription>
            {mode === 'start' ? 'Start' : 'Complete'} stage: {stage.production_stage.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Stage Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stage.production_stage.color }}
              />
              <div>
                <p className="font-medium text-blue-800">
                  Stage {stage.stage_order}: {stage.production_stage.name}
                </p>
                <p className="text-sm text-blue-600 flex items-center gap-1">
                  {mode === 'start' ? (
                    <>
                      <Clock className="h-3 w-3" />
                      Start working on this stage
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3" />
                      Mark stage as complete
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Scan Method Tabs */}
          <Tabs value={scanMethod} onValueChange={(value) => setScanMethod(value as 'manual' | 'camera')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Manual Entry
              </TabsTrigger>
              <TabsTrigger value="camera" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Scan Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="qr-code">QR Code Data</Label>
                <Input
                  id="qr-code"
                  value={qrCode}
                  onChange={(e) => handleQRCodeChange(e.target.value)}
                  placeholder="Paste or enter QR code data"
                  autoFocus
                />
              </div>
            </TabsContent>

            <TabsContent value="camera" className="space-y-3">
              <div className="space-y-2">
                <Label>Upload QR Code Image</Label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Upload QR Image
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    Take a photo or upload an image of the QR code
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Parsed Data Display */}
          {parsedData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">QR Data Validated</span>
              </div>
              <div className="space-y-1 text-sm">
                {parsedData.wo_no && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Work Order:</span>
                    <Badge variant="outline">{parsedData.wo_no}</Badge>
                  </div>
                )}
                {parsedData.customer && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Customer:</span>
                    <span className="font-medium">{parsedData.customer}</span>
                  </div>
                )}
                {parsedData.generated_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Generated:</span>
                    <span className="text-xs">{new Date(parsedData.generated_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes Section */}
          {mode === 'complete' && (
            <div className="space-y-2">
              <Label htmlFor="notes">Stage Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this stage completion..."
                rows={3}
              />
            </div>
          )}

          {/* Quick Scan Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Quick Scan Tips:</p>
              <ul className="space-y-1 text-xs">
                <li>• QR codes should contain job information</li>
                <li>• Ensure good lighting when scanning images</li>
                <li>• Manual entry works for any text-based codes</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            onClick={handleScan} 
            disabled={isProcessing || !qrCode.trim()}
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              "Processing..."
            ) : (
              <>
                <Scan className="h-4 w-4" />
                {mode === 'start' ? 'Start' : 'Complete'} Stage
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
