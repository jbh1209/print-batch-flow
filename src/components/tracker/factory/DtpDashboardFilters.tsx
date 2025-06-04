
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  RefreshCw, 
  Search
} from "lucide-react";
import { BarcodeScannerButton } from "./BarcodeScannerButton";

interface DtpDashboardFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onScanSuccess: (data: string) => void;
  refreshing: boolean;
  dtpJobsCount: number;
  proofJobsCount: number;
}

export const DtpDashboardFilters: React.FC<DtpDashboardFiltersProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  onScanSuccess,
  refreshing,
  dtpJobsCount,
  proofJobsCount
}) => {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">
        Showing {dtpJobsCount} DTP jobs and {proofJobsCount} Proof jobs
      </p>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search jobs, customers, references..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        
        <BarcodeScannerButton 
          onScanSuccess={onScanSuccess}
          className="h-12"
        />
        
        <Button 
          variant="outline" 
          onClick={onRefresh}
          disabled={refreshing}
          className="h-12"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
};
