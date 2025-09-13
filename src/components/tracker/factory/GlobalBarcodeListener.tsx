
import React, { useEffect, useRef } from "react";

interface GlobalBarcodeListenerProps {
  onBarcodeDetected: (barcodeData: string) => void;
  minLength?: number;
  timeout?: number;
}

export const GlobalBarcodeListener: React.FC<GlobalBarcodeListenerProps> = ({
  onBarcodeDetected,
  minLength = 5,
  timeout = 500
}) => {
  const barcodeRef = useRef<string>("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore keystrokes when user is typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Handle Enter key (common barcode scanner behavior)
      if (event.key === 'Enter') {
        if (barcodeRef.current.length >= minLength) {
          onBarcodeDetected(barcodeRef.current);
        }
        barcodeRef.current = "";
        return;
      }

      // Handle Tab key (some scanners use this)
      if (event.key === 'Tab' && barcodeRef.current.length >= minLength) {
        event.preventDefault();
        onBarcodeDetected(barcodeRef.current);
        barcodeRef.current = "";
        return;
      }

      // Accumulate characters
      if (event.key.length === 1) {
        barcodeRef.current += event.key;
        
        // Set timeout to process accumulated data
        timeoutRef.current = setTimeout(() => {
          if (barcodeRef.current.length >= minLength) {
            onBarcodeDetected(barcodeRef.current);
          }
          barcodeRef.current = "";
        }, timeout);
      }
    };

    // Add event listeners for both keypress and keydown
    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('keydown', handleKeyPress);

    // Cleanup
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('keydown', handleKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onBarcodeDetected, minLength, timeout]);

  return null; // This component doesn't render anything
};
