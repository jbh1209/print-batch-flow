
import React from "react";
import { TableHead } from "@/components/ui/table";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSortField: string | null;
  currentSortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  className?: string;
}

export const SortableTableHead: React.FC<SortableTableHeadProps> = ({
  children,
  sortKey,
  currentSortField,
  currentSortOrder,
  onSort,
  className
}) => {
  const isActive = currentSortField === sortKey;
  
  const getSortIcon = () => {
    if (!isActive) {
      return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
    }
    return currentSortOrder === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-blue-600" />
      : <ChevronDown className="h-4 w-4 text-blue-600" />;
  };

  return (
    <TableHead 
      className={cn(
        "cursor-pointer hover:bg-gray-50 transition-colors select-none",
        isActive && "bg-blue-50",
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-medium", isActive && "text-blue-600")}>
          {children}
        </span>
        {getSortIcon()}
      </div>
    </TableHead>
  );
};
