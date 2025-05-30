
import React from "react";
import { Badge } from "@/components/ui/badge";

interface QRCodeLabelProps {
  woNo: string;
  qrCodeDataURL: string;
  customer?: string;
  dueDate?: string;
  status?: string;
}

export const QRCodeLabel = ({ woNo, qrCodeDataURL, customer, dueDate, status }: QRCodeLabelProps) => {
  return (
    <div 
      className="bg-white border-2 border-black flex flex-col items-center justify-center p-4"
      style={{ 
        width: '100mm', 
        height: '50mm',
        fontSize: '10pt',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Header with WO Number and Status */}
      <div className="text-center font-bold text-sm mb-2 w-full">
        <div className="flex items-center justify-center gap-2">
          <span>WO: {woNo}</span>
          {status && (
            <Badge variant="outline" className="text-xs px-1 py-0">
              {status}
            </Badge>
          )}
        </div>
      </div>
      
      {/* QR Code */}
      <div className="flex-1 flex items-center justify-center">
        <img 
          src={qrCodeDataURL} 
          alt={`QR Code for ${woNo}`}
          className="max-w-full max-h-full"
          style={{ width: '28mm', height: '28mm' }}
        />
      </div>
      
      {/* Footer with additional info */}
      <div className="text-center text-xs mt-2 w-full space-y-1">
        {customer && (
          <div className="truncate font-medium">{customer}</div>
        )}
        <div className="flex justify-between items-center text-xs">
          {dueDate && (
            <span>Due: {new Date(dueDate).toLocaleDateString()}</span>
          )}
          <span className="text-gray-500">
            {new Date().toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};
