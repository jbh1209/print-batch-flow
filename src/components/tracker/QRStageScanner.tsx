
import React, { useState } from "react";
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
import { QrCode, Scan } from "lucide-react";

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

  const handleScan = async () => {
    if (!stage || !qrCode.trim()) return;

    setIsProcessing(true);
    try {
      const qrData = {
        qr_code: qrCode,
        scan_time: new Date().toISOString(),
        mode,
        stage_id: stage.id
      };

      await onScan(stage.id, qrData, notes || undefined);
      
      // Reset form
      setQrCode('');
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Error processing QR scan:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setQrCode('');
    setNotes('');
    onClose();
  };

  if (!stage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
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
          <div className="space-y-2">
            <Label htmlFor="qr-code">QR Code</Label>
            <div className="flex gap-2">
              <Input
                id="qr-code"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                placeholder="Scan or enter QR code"
                autoFocus
              />
              <Button variant="outline" size="sm">
                <Scan className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {mode === 'complete' && (
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this stage..."
                rows={3}
              />
            </div>
          )}

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
                <p className="text-sm text-blue-600">
                  Action: {mode === 'start' ? 'Start working on this stage' : 'Mark stage as complete'}
                </p>
              </div>
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
          >
            {isProcessing ? "Processing..." : `${mode === 'start' ? 'Start' : 'Complete'} Stage`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
