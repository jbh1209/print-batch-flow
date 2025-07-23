
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, X } from "lucide-react";

interface SpecificationFilterProps {
  onFilterChange: (filters: SpecificationFilters) => void;
  availableSpecs: {
    sizes: string[];
    paperTypes: string[];
    paperWeights: string[];
    laminations: string[];
  };
  className?: string;
}

export interface SpecificationFilters {
  size?: string;
  paperType?: string;
  paperWeight?: string;
  lamination?: string;
  searchTerm?: string;
}

export const SpecificationFilter: React.FC<SpecificationFilterProps> = ({
  onFilterChange,
  availableSpecs,
  className = ""
}) => {
  const [filters, setFilters] = useState<SpecificationFilters>({});
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof SpecificationFilters, value: string | undefined) => {
    const newFilters = { ...filters, [key]: value };
    if (!value) {
      delete newFilters[key];
    }
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilter = (key: keyof SpecificationFilters) => {
    updateFilter(key, undefined);
  };

  const clearAllFilters = () => {
    setFilters({});
    onFilterChange({});
  };

  const activeFilterCount = Object.keys(filters).filter(key => 
    filters[key as keyof SpecificationFilters]
  ).length;

  return (
    <div className={className}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative">
            <Filter className="h-4 w-4 mr-2" />
            Specifications
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-4 w-4 p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Filter by Specifications</h4>
              {activeFilterCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="text-xs"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="search" className="text-xs">Search</Label>
                <Input
                  id="search"
                  placeholder="Search specifications..."
                  value={filters.searchTerm || ''}
                  onChange={(e) => updateFilter('searchTerm', e.target.value)}
                  className="h-8"
                />
              </div>

              <div>
                <Label className="text-xs">Size</Label>
                <Select 
                  value={filters.size || ''} 
                  onValueChange={(value) => updateFilter('size', value || undefined)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Any size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any size</SelectItem>
                    {availableSpecs.sizes.map((size) => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Paper Type</Label>
                <Select 
                  value={filters.paperType || ''} 
                  onValueChange={(value) => updateFilter('paperType', value || undefined)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Any paper" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any paper</SelectItem>
                    {availableSpecs.paperTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Paper Weight</Label>
                <Select 
                  value={filters.paperWeight || ''} 
                  onValueChange={(value) => updateFilter('paperWeight', value || undefined)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Any weight" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any weight</SelectItem>
                    {availableSpecs.paperWeights.map((weight) => (
                      <SelectItem key={weight} value={weight}>{weight}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Lamination</Label>
                <Select 
                  value={filters.lamination || ''} 
                  onValueChange={(value) => updateFilter('lamination', value || undefined)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Any lamination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any lamination</SelectItem>
                    {availableSpecs.laminations.map((lamination) => (
                      <SelectItem key={lamination} value={lamination}>{lamination}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Active Filters:</Label>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(filters).map(([key, value]) => {
                    if (!value) return null;
                    return (
                      <Badge key={key} variant="secondary" className="text-xs">
                        {key}: {value}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-3 w-3 p-0 ml-1"
                          onClick={() => clearFilter(key as keyof SpecificationFilters)}
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
