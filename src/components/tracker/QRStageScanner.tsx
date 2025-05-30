
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { QrCode, Scan, CheckCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseQRCodeData } from "@/utils/qrCodeGenerator";

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
  };
  mode: 'start' | 'complete';
}

export const QRStageScanner = ({
  isOpen,
  onClose,
  onScan,
  stage,
  mode
}: QRStageScannerProps) => {
  const [qrInput, setQrInput] = useState("");
  const [notes, setNotes] = useState("");
  const [scannedData, setScannedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQRInput = (value: string) => {
    setQrInput(value);
    
    // Try to parse QR code data
    const parsed = parseQRCodeData(value);
    if (parsed) {
      setScannedData(parsed);
    } else {
      // If not JSON, treat as plain text
      setScannedData({ raw_data: value });
    }
  };

  const handleSubmit = async () => {
    if (!stage || !scannedData) return;
    
    setIsProcessing(true);
    try {
      const qrData = {
        ...scannedData,
        scan_mode: mode,
        scanner_notes: notes,
        scanned_at: new Date().toISOString()
      };
      
      await onScan(stage.id, qrData, notes);
      
      // Reset form
      setQrInput("");
      setNotes("");
      setScannedData(null);
      onClose();
    } catch (error) {
      console.error('Error processing scan:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setQrInput("");
    setNotes("");
    setScannedData(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            {mode === 'start' ? 'Start Stage' : 'Complete Stage'} - QR Scan
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Stage Info */}
          {stage && (
            <Card className="bg-gray-50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: stage.production_stage.color }}
                  />
                  <span className="font-medium">{stage.production_stage.name}</span>
                  <Badge variant="outline" className="ml-auto">
                    {mode === 'start' ? 'Starting' : 'Completing'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* QR Input */}
          <div className="space-y-2">
            <Label htmlFor="qr-input">
              Scan or Enter QR Code Data
            </Label>
            <div className="relative">
              <Input
                id="qr-input"
                placeholder="Scan QR code or paste data here..."
                value={qrInput}
                onChange={(e) => handleQRInput(e.target.value)}
                className="pr-10"
              />
              <Scan className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            {qrInput && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Parsed QR Data */}
          {scannedData && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">QR Code Detected</span>
                </div>
                <div className="text-sm text-green-700">
                  {scannedData.wo_no && (
                    <div><strong>WO:</strong> {scannedData.wo_no}</div>
                  )}
                  {scannedData.customer && (
                    <div><strong>Customer:</strong> {scannedData.customer}</div>
                  )}
                  {scannedData.raw_data && !scannedData.wo_no && (
                    <div><strong>Data:</strong> {scannedData.raw_data}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this stage..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!scannedData || isProcessing}
              className="flex-1"
            >
              {isProcessing ? 'Processing...' : 
               mode === 'start' ? 'Start Stage' : 'Complete Stage'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
