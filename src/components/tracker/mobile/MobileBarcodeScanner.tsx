import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Camera, 
  Type, 
  CheckCircle, 
  AlertCircle,
  History,
  Smartphone,
  Barcode
} from "lucide-react";
import { useMobileBarcodeScanner } from "@/hooks/tracker/useMobileBarcodeScanner";
import { toast } from "sonner";

interface MobileBarcodeScannerProps {
  onScanSuccess?: (data: any) => void;
  onJobAction?: (jobId: string, stageId: string, action: string) => void;
}

export const MobileBarcodeScanner: React.FC<MobileBarcodeScannerProps> = ({
  onScanSuccess,
  onJobAction
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  
  const {
    isScanning,
    lastScan,
    startScanning,
    stopScanning,
    clearLastScan,
    simulateScan,
    hasCameraSupport,
    hasShareSupport
  } = useMobileBarcodeScanner();

  const handleManualScan = () => {
    if (!manualInput.trim()) {
      toast.error('Please enter barcode data');
      return;
    }

    const result = simulateScan(manualInput);
    
    if (result.isValid && onScanSuccess) {
      onScanSuccess(result.parsedData);
    }
    
    setManualInput("");
  };

  const handleStartCamera = () => {
    if (hasCameraSupport()) {
      startScanning();
      toast.info('Camera scanning will be available in a future update');
    } else {
      toast.error('Camera not supported on this device');
    }
  };

  const handleProcessScan = () => {
    if (lastScan?.isValid && onJobAction && lastScan.parsedData) {
      const { wo_no, job_id_partial } = lastScan.parsedData;
      onJobAction(job_id_partial, wo_no, 'barcode-scan');
      clearLastScan();
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Barcode className="h-4 w-4 mr-2" />
          Barcode Scanner
        </Button>
      </SheetTrigger>
      
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Barcode Scanner
          </SheetTitle>
          <SheetDescription>
            Scan barcodes to track job progress and stage transitions
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          
          {/* Scan Mode Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Scan Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant={scanMode === 'camera' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScanMode('camera')}
                  disabled={!hasCameraSupport()}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Camera
                </Button>
                <Button
                  variant={scanMode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScanMode('manual')}
                  className="flex-1"
                >
                  <Type className="h-4 w-4 mr-2" />
                  Manual
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Camera Scanner */}
          {scanMode === 'camera' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Camera Scanner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 mb-4">
                    {hasCameraSupport() 
                      ? 'Camera scanner will be available soon' 
                      : 'Camera not supported on this device'}
                  </p>
                  <Button 
                    onClick={handleStartCamera}
                    disabled={!hasCameraSupport() || isScanning}
                  >
                    {isScanning ? 'Scanning...' : 'Start Camera'}
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <span>Camera Support:</span>
                    <Badge variant={hasCameraSupport() ? "default" : "secondary"}>
                      {hasCameraSupport() ? "Available" : "Not Available"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Share Support:</span>
                    <Badge variant={hasShareSupport() ? "default" : "secondary"}>
                      {hasShareSupport() ? "Available" : "Not Available"}
                    </Badge>
                  </div>
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
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Input
                    placeholder="Enter barcode data..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualScan();
                      }
                    }}
                  />
                  <Button onClick={handleManualScan} className="w-full">
                    <Barcode className="h-4 w-4 mr-2" />
                    Process Barcode Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Last Scan Result */}
          {lastScan && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Last Scan Result
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  {lastScan.isValid ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="text-sm">
                      <div className="font-medium">
                        {lastScan.isValid ? 'Valid Barcode' : 'Invalid Barcode'}
                      </div>
                      <div className="text-gray-600 text-xs">
                        Scanned at {new Date(lastScan.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    {lastScan.isValid && lastScan.parsedData && (
                      <div className="space-y-1 text-xs">
                        <div>Work Order: {lastScan.parsedData.wo_no}</div>
                        <div>Job ID Partial: {lastScan.parsedData.job_id_partial}</div>
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-500 break-all">
                      Raw: {lastScan.rawData}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {lastScan.isValid && (
                    <Button size="sm" onClick={handleProcessScan}>
                      Process Action
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={clearLastScan}>
                    Clear
                  </Button>
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
                <p>• Use camera mode to scan physical barcodes</p>
                <p>• Use manual mode to paste or type barcode data</p>
                <p>• Valid barcodes contain work order and job information</p>
                <p>• Successful scans will trigger stage actions automatically</p>
                <p>• Barcode format: WO[order_number]J[job_id_partial]</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};
