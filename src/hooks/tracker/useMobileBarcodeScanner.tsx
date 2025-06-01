
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { parseBarcodeData } from "@/utils/barcodeGenerator";

interface BarcodeScanResult {
  rawData: string;
  parsedData: any;
  isValid: boolean;
  timestamp: string;
}

export const useMobileBarcodeScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScan, setLastScan] = useState<BarcodeScanResult | null>(null);

  const processBarcodeData = useCallback((rawData: string): BarcodeScanResult => {
    const timestamp = new Date().toISOString();
    
    // Try to parse the barcode data
    const parsedData = parseBarcodeData(rawData);
    const isValid = parsedData !== null;

    const result: BarcodeScanResult = {
      rawData,
      parsedData,
      isValid,
      timestamp
    };

    setLastScan(result);
    
    if (isValid) {
      toast.success("Barcode scanned successfully");
    } else {
      toast.warning("Barcode format not recognized");
    }

    return result;
  }, []);

  const startScanning = useCallback(() => {
    setIsScanning(true);
    // In a real implementation, this would start camera scanning
    toast.info("Barcode scanner ready - use manual input for now");
  }, []);

  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  const clearLastScan = useCallback(() => {
    setLastScan(null);
  }, []);

  // Simulate scan from manual input
  const simulateScan = useCallback((data: string) => {
    return processBarcodeData(data);
  }, [processBarcodeData]);

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
    processBarcodeData
  };
};
