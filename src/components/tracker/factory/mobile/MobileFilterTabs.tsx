
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterCount {
  all: number;
  available: number;
  'my-active': number;
  urgent: number;
}

type FilterType = keyof FilterCount;

interface MobileFilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: FilterCount;
}

export const MobileFilterTabs: React.FC<MobileFilterTabsProps> = ({
  activeFilter,
  onFilterChange,
  counts
}) => {
  const filters = [
    { key: 'available' as FilterType, label: 'Available', count: counts.available },
    { key: 'my-active' as FilterType, label: 'Active', count: counts['my-active'] },
    { key: 'urgent' as FilterType, label: 'Urgent', count: counts.urgent },
    { key: 'all' as FilterType, label: 'All', count: counts.all }
  ];

  return (
    <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4">
      {filters.map(filter => (
        <Button
          key={filter.key}
          variant={activeFilter === filter.key ? "default" : "outline"}
          size="sm"
          onClick={() => onFilterChange(filter.key)}
          className={cn(
            "flex-shrink-0 h-12 px-4 touch-manipulation",
            "flex flex-col items-center justify-center gap-1"
          )}
        >
          <span className="text-xs font-medium">{filter.label}</span>
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs px-1.5 py-0",
              activeFilter === filter.key ? "bg-white/20 text-white" : ""
            )}
          >
            {filter.count}
          </Badge>
        </Button>
      ))}
    </div>
  );
};
