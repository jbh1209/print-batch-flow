
import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { productConfigs } from '@/config/productTypes';

interface JobsFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterProductType: string;
  setFilterProductType: (type: string) => void;
}

const JobsFilters: React.FC<JobsFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  filterProductType,
  setFilterProductType
}) => {
  return (
    <div className="p-4 border-b flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search jobs by name or job number..."
          className="w-full md:max-w-xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter by type:</span>
        <Select
          value={filterProductType}
          onValueChange={setFilterProductType}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Product Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Product Types</SelectItem>
            {Object.values(productConfigs).map((config) => (
              <SelectItem 
                key={config.productType} 
                value={config.productType}
              >
                {config.productType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default JobsFilters;
