
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { parseQRCodeData } from "@/utils/qrCodeGenerator";

interface QRScanResult {
  rawData: string;
  parsedData: any;
  isValid: boolean;
  timestamp: string;
}

export const useMobileQRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<QRScanResult | null>(null);

  const processQRData = useCallback((rawData: string): QRScanResult => {
    const timestamp = new Date().toISOString();
    
    // Try to parse the QR data
    const parsedData = parseQRCodeData(rawData);
    const isValid = parsedData !== null;

    const result: QRScanResult = {
      rawData,
      parsedData,
      isValid,
      timestamp
    };

    setLastScan(result);
    
    if (isValid) {
      toast.success("QR code scanned successfully");
    } else {
      toast.warning("QR code format not recognized");
    }

    return result;
  }, []);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    // In a real implementation, this would start camera scanning
    toast.info("QR scanner ready - use manual input for now");
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  const clearLastScan = useCallback(() => {
    setLastScan(null);
  }, []);

  // Simulate scan from manual input
  const simulateScan = useCallback((data: string) => {
    return processQRData(data);
  }, [processQRData]);

  // Check if device supports camera
  const hasCameraSupport = useCallback(() => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }, []);

  // Check if device supports file sharing
  const hasShareSupport = useCallback(() => {
    return !!navigator.share;
  }, []);

  return {
    isScanning,
    lastScan,
    startScanning,
    stopScanning,
    clearLastScan,
    simulateScan,
    hasCameraSupport,
    hasShareSupport,
    processQRData
  };
};
