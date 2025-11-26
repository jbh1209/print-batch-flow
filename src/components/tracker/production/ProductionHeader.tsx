
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
    <div className="mb-0 pb-0 flex-shrink-0">
      <div className="flex items-center gap-2 mb-0">
        <Button variant="outline" size="sm" asChild>
          <Link to="/tracker/dashboard" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <div className="flex flex-row items-center justify-between gap-2 py-1">
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold leading-tight mb-0">Production Workflow</h1>
          <p className="text-gray-600 text-xs leading-4 mt-0 mb-0">Manage stages and monitor jobs in real time</p>
        </div>
        <div className="flex flex-row items-center gap-1 space-x-0">
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
            className="px-2 sm:px-2"
          >
            <Settings className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Configure Stages</span>
          </Button>
          {!isMobile && (
            <Button
              variant="outline"
              size="sm"
              onClick={onQRScanner}
              className="px-2"
            >
              <QrCode className="mr-1 h-4 w-4" />
              <span className="hidden sm:inline">QR Scanner</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
