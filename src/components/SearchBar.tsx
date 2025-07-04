
import React, { useState } from "react";
import { Search, Filter, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onBatchFilter?: (filter: string) => void;
  placeholder?: string;
  includeBatchFilters?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearch, 
  onBatchFilter,
  placeholder = "Search batches, jobs...",
  includeBatchFilters = false
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const handleBatchFilterChange = (value: string) => {
    setBatchFilter(value);
    onBatchFilter?.(value === "all" ? "" : value);
  };

  return (
    <div className="flex items-center gap-2 w-full max-w-2xl">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full py-2 pl-10 pr-4 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder={placeholder}
        />
      </div>
      
      {includeBatchFilters && (
        <Select value={batchFilter} onValueChange={handleBatchFilterChange}>
          <SelectTrigger className="w-40">
            <Package className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Jobs</SelectItem>
            <SelectItem value="individual">Individual Only</SelectItem>
            <SelectItem value="batched">In Batch</SelectItem>
            <SelectItem value="batch_master">Batch Masters</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export default SearchBar;
