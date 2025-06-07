
import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { SimpleJobsView } from "@/components/tracker/common/SimpleJobsView";
import { ProductionHeader } from "@/components/tracker/production/ProductionHeader";
import { TrackerErrorBoundary } from "@/components/tracker/error-boundaries/TrackerErrorBoundary";
import { useIsMobile } from "@/hooks/use-mobile";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
  selectedStageId?: string;
  onStageSelect?: (stageId: string | null) => void;
  onFilterChange?: (filters: any) => void;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext>();
  const isMobile = useIsMobile();
  
  const [searchQuery, setSearchQuery] = useState("");

  // Use context filters or defaults
  const currentFilters = context?.filters || {};

  const handleQRScan = (data: any) => {
    console.log("QR scan data:", data);
    // QR scan functionality can be implemented here
  };

  const handleConfigureStages = () => {
    console.log("Configure stages");
    // Navigate to admin or show configuration
  };

  const handleQRScanner = () => {
    console.log("QR scanner");
    // Open QR scanner
  };

  const handleStageAction = async (jobId: string, stageId: string, action: 'start' | 'complete' | 'qr-scan'): Promise<void> => {
    console.log("Stage action:", { jobId, stageId, action });
    // Stage action functionality can be implemented here
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <TrackerErrorBoundary componentName="Production Header">
        <ProductionHeader
          isMobile={isMobile}
          onQRScan={handleQRScan}
          onStageAction={handleStageAction}
          onConfigureStages={handleConfigureStages}
          onQRScanner={handleQRScanner}
        />
      </TrackerErrorBoundary>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <TrackerErrorBoundary componentName="Jobs View">
          <SimpleJobsView
            statusFilter={currentFilters.status}
            stageFilter={currentFilters.stage}
            searchQuery={searchQuery}
            title="Production Jobs"
            subtitle="All production jobs in the system"
            groupByStage={false}
          />
        </TrackerErrorBoundary>
      </div>
    </div>
  );
};

export default TrackerProduction;
