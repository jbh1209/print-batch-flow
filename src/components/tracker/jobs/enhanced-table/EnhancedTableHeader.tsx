
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, Filter } from "lucide-react";

interface EnhancedTableHeaderProps {
  jobCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  showColumnFilters: boolean;
  setShowColumnFilters: (show: boolean) => void;
}

export const EnhancedTableHeader: React.FC<EnhancedTableHeaderProps> = ({
  jobCount,
  searchQuery,
  setSearchQuery,
  onRefresh,
  showColumnFilters,
  setShowColumnFilters
}) => {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-semibold">Production Jobs ({jobCount})</h2>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowColumnFilters(!showColumnFilters)}
          className={showColumnFilters ? "bg-blue-50 border-blue-200" : ""}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>
    </div>
  );
};
