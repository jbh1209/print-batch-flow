
import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw } from "lucide-react";

interface ProductionManagerHeaderProps {
  jobCount: number;
  statusFilter: string | null;
  setStatusFilter: (filter: string | null) => void;
  uniqueStatuses: string[];
  onRefresh: () => void;
  refreshing: boolean;
}

export const ProductionManagerHeader: React.FC<ProductionManagerHeaderProps> = ({
  jobCount,
  statusFilter,
  setStatusFilter,
  uniqueStatuses,
  onRefresh,
  refreshing
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Production Management</h1>
        <p className="text-gray-600">Overview of all production jobs</p>
        <p className="text-sm text-gray-500 mt-1">
          Managing {jobCount} job{jobCount !== 1 ? 's' : ''}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? null : value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button 
          variant="outline" 
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
};
