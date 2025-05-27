
import React from "react";
import { Card, CardContent } from "@/components/ui/card";

interface QRCodeLabelProps {
  woNo: string;
  qrCodeDataURL: string;
  customer?: string;
  dueDate?: string;
}

export const QRCodeLabel = ({ woNo, qrCodeDataURL, customer, dueDate }: QRCodeLabelProps) => {
  return (
    <div 
      className="bg-white border border-black flex flex-col items-center justify-center p-2"
      style={{ 
        width: '100mm', 
        height: '50mm',
        fontSize: '8pt',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Header with WO Number */}
      <div className="text-center font-bold text-xs mb-1">
        WO: {woNo}
      </div>
      
      {/* QR Code */}
      <div className="flex-1 flex items-center justify-center">
        <img 
          src={qrCodeDataURL} 
          alt={`QR Code for ${woNo}`}
          className="max-w-full max-h-full"
          style={{ width: '30mm', height: '30mm' }}
        />
      </div>
      
      {/* Footer with additional info */}
      <div className="text-center text-xs mt-1">
        {customer && <div className="truncate">{customer}</div>}
        {dueDate && <div>Due: {new Date(dueDate).toLocaleDateString()}</div>}
      </div>
    </div>
  );
};
