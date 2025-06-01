
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { MobileQRScanner } from "@/components/tracker/mobile/MobileQRScanner";

interface ProductionHeaderProps {
  isMobile: boolean;
  onQRScan: (data: any) => void;
  onStageAction: (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan') => Promise<void>;
  onConfigureStages: () => void;
  onQRScanner: () => void;
}

export const ProductionHeader: React.FC<ProductionHeaderProps> = ({
  isMobile,
  onQRScan,
  onStageAction,
  onConfigureStages,
  onQRScanner
}) => {
  return (
    <div className="mb-6 flex-shrink-0">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="sm" asChild>
          <Link to="/tracker" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
      
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Production Workflow</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Monitor and manage production stages with real-time tracking
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Mobile QR Scanner - Always visible on mobile */}
          {isMobile && (
            <MobileQRScanner
              onScanSuccess={onQRScan}
              onJobAction={onStageAction}
            />
          )}
          
          <Button 
            variant="outline" 
            size={isMobile ? "sm" : "default"}
            onClick={onConfigureStages}
          >
            <Settings className="mr-2 h-4 w-4" />
            {isMobile ? "" : "Configure Stages"}
          </Button>

          {/* Desktop QR Scanner */}
          {!isMobile && (
            <Button 
              variant="outline"
              onClick={onQRScanner}
            >
              <QrCode className="mr-2 h-4 w-4" />
              QR Scanner
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
