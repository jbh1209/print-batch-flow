
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Scan, 
  Camera, 
  Type, 
  CheckCircle, 
  Clock,
  Smartphone,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMobileQRScanner } from "@/hooks/tracker/useMobileQRScanner";
import { toast } from "sonner";

const TrackerMobileScanner = () => {
  const [qrInput, setQrInput] = useState('');
  const { 
    lastScan, 
    simulateScan, 
    hasCameraSupport, 
    hasShareSupport 
  } = useMobileQRScanner();

  const handleManualScan = () => {
    if (qrInput.trim()) {
      simulateScan(qrInput);
      setQrInput('');
    }
  };

  const handleCameraScan = () => {
    if (hasCameraSupport()) {
      toast.info("Camera scanning will be implemented in a future update");
    } else {
      toast.error("Camera not supported on this device");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">Mobile QR Scanner</h1>
            <p className="text-sm text-gray-600">Scan job QR codes on the go</p>
          </div>
        </div>

        {/* Device Capabilities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5" />
              Device Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Camera Access</span>
              <Badge variant={hasCameraSupport() ? "default" : "secondary"}>
                {hasCameraSupport() ? "Available" : "Not Available"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Share Feature</span>
              <Badge variant={hasShareSupport() ? "default" : "secondary"}>
                {hasShareSupport() ? "Available" : "Not Available"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Scanner Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code Scanner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="manual" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Manual
                </TabsTrigger>
                <TabsTrigger value="camera" className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Camera
                </TabsTrigger>
              </TabsList>

              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qr-input">Enter QR Code Data</Label>
                  <Input
                    id="qr-input"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="Paste or type QR code data"
                  />
                </div>
                <Button 
                  onClick={handleManualScan}
                  disabled={!qrInput.trim()}
                  className="w-full flex items-center gap-2"
                >
                  <Scan className="h-4 w-4" />
                  Process QR Code
                </Button>
              </TabsContent>

              <TabsContent value="camera" className="space-y-4">
                <div className="text-center space-y-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-8">
                    <Camera className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">
                      Camera scanning coming soon
                    </p>
                    <Button 
                      onClick={handleCameraScan}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Test Camera Access
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Last Scan Result */}
        {lastScan && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Last Scan Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm font-mono break-all">
                  {lastScan.rawData}
                </div>
              </div>
              
              {lastScan.isValid && lastScan.parsedData && (
                <div className="space-y-2">
                  <div className="font-medium text-green-800">Parsed Data:</div>
                  {lastScan.parsedData.wo_no && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Work Order:</span>
                      <Badge variant="outline">{lastScan.parsedData.wo_no}</Badge>
                    </div>
                  )}
                  {lastScan.parsedData.customer && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium">{lastScan.parsedData.customer}</span>
                    </div>
                  )}
                  {lastScan.parsedData.job_id && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Job ID:</span>
                      <span className="font-mono text-xs">{lastScan.parsedData.job_id}</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="text-xs text-gray-500">
                Scanned: {new Date(lastScan.timestamp).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How to Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 text-blue-500" />
              <div>
                <div className="font-medium">Starting Stages</div>
                <div>Scan QR code when beginning work on a stage</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
              <div>
                <div className="font-medium">Completing Stages</div>
                <div>Scan QR code when finishing work on a stage</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <QrCode className="h-4 w-4 mt-0.5 text-purple-500" />
              <div>
                <div className="font-medium">QR Code Format</div>
                <div>Each job has a unique QR code for tracking</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrackerMobileScanner;
