
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Filter } from "lucide-react";

interface JobsTableHeaderProps {
  jobCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  showColumnFilters: boolean;
  onToggleColumnFilters: () => void;
}

export const JobsTableHeader: React.FC<JobsTableHeaderProps> = ({
  jobCount,
  searchQuery,
  onSearchChange,
  onRefresh,
  showColumnFilters,
  onToggleColumnFilters
}) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <CardTitle className="text-lg">Production Jobs ({jobCount})</CardTitle>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 w-full sm:w-64"
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onToggleColumnFilters}
                className={showColumnFilters ? "bg-blue-50 border-blue-200" : ""}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};
