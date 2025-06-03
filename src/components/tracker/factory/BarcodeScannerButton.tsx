
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  QrCode, 
  Camera, 
  Type, 
  CheckCircle, 
  AlertCircle,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BarcodeScannerButtonProps {
  onScanSuccess: (data: string) => void;
  className?: string;
}

export const BarcodeScannerButton: React.FC<BarcodeScannerButtonProps> = ({
  onScanSuccess,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [hasCameraSupport, setHasCameraSupport] = useState(false);

  useEffect(() => {
    // Check camera support
    setHasCameraSupport(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
  }, []);

  const handleManualScan = () => {
    if (!manualInput.trim()) {
      toast.error('Please enter barcode data');
      return;
    }

    setLastScan(manualInput);
    onScanSuccess(manualInput);
    toast.success(`Barcode processed: ${manualInput}`);
    setManualInput("");
    setIsOpen(false);
  };

  const handleStartCamera = async () => {
    if (!hasCameraSupport) {
      toast.error('Camera not supported on this device');
      return;
    }

    try {
      setIsScanning(true);
      // In a real implementation, this would start camera scanning
      // For now, we'll show a message
      toast.info('Camera scanning will be available in a future update. Use manual input for now.');
    } catch (error) {
      toast.error('Failed to start camera');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          className={cn(
            "bg-blue-600 hover:bg-blue-700 text-white shadow-lg touch-manipulation",
            className
          )}
        >
          <QrCode className="h-5 w-5 mr-2" />
          Scan Job
        </Button>
      </SheetTrigger>
      
      <SheetContent side="bottom" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Job Scanner
          </SheetTitle>
          <SheetDescription>
            Scan job barcodes or QR codes to quickly find and work on jobs
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Scan Mode Toggle */}
          <div className="flex border rounded-lg p-1 bg-gray-100">
            <Button
              variant={scanMode === 'camera' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setScanMode('camera')}
              className="flex-1"
              disabled={!hasCameraSupport}
            >
              <Camera className="h-4 w-4 mr-2" />
              Camera
            </Button>
            <Button
              variant={scanMode === 'manual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setScanMode('manual')}
              className="flex-1"
            >
              <Type className="h-4 w-4 mr-2" />
              Manual
            </Button>
          </div>

          {/* Camera Scanner */}
          {scanMode === 'camera' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Camera Scanner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <Camera className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-4 font-medium">
                    {hasCameraSupport 
                      ? 'Point camera at job barcode or QR code' 
                      : 'Camera not supported on this device'}
                  </p>
                  <Button 
                    onClick={isScanning ? stopScanning : handleStartCamera}
                    disabled={!hasCameraSupport}
                    className={isScanning ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}
                  >
                    {isScanning ? 'Stop Scanning' : 'Start Camera'}
                  </Button>
                </div>

                <div className="flex justify-center">
                  <Badge variant={hasCameraSupport ? "default" : "secondary"}>
                    Camera: {hasCameraSupport ? "Available" : "Not Available"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Input */}
          {scanMode === 'manual' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Manual Input</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Input
                    placeholder="Enter job number, barcode, or QR data..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualScan();
                      }
                    }}
                    className="text-lg h-12"
                  />
                  <Button 
                    onClick={handleManualScan} 
                    className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
                    disabled={!manualInput.trim()}
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Find Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Last Scan Result */}
          {lastScan && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  Last Scan Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-green-800 break-all">
                  {lastScan}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-gray-600 space-y-1">
                <p>• Use camera mode to scan job barcodes or QR codes</p>
                <p>• Use manual mode to type or paste job numbers</p>
                <p>• Scanner will find and highlight matching jobs</p>
                <p>• Jobs will auto-scroll into view when found</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};
