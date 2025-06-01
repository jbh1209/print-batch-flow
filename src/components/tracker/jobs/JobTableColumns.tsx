
import React from "react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SortableTableHead } from "./SortableTableHead";

interface JobTableColumnsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: (selected: boolean) => void;
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export const JobTableColumns: React.FC<JobTableColumnsProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  sortField,
  sortOrder,
  onSort
}) => {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;
  const isPartiallySelected = selectedCount > 0 && selectedCount < totalCount;

  return (
    <TableHeader>
      <TableRow className="border-b">
        <TableHead className="w-12 px-2">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={onSelectAll}
            className={isPartiallySelected ? "opacity-50" : ""}
          />
        </TableHead>
        <SortableTableHead
          sortKey="wo_no"
          currentSortField={sortField}
          currentSortOrder={sortOrder}
          onSort={onSort}
          className="min-w-[120px]"
        >
          WO Number
        </SortableTableHead>
        <SortableTableHead
          sortKey="customer"
          currentSortField={sortField}
          currentSortOrder={sortOrder}
          onSort={onSort}
          className="min-w-[120px]"
        >
          Customer
        </SortableTableHead>
        <SortableTableHead
          sortKey="reference"
          currentSortField={sortField}
          currentSortOrder={sortOrder}
          onSort={onSort}
          className="min-w-[100px]"
        >
          Reference
        </SortableTableHead>
        <SortableTableHead
          sortKey="qty"
          currentSortField={sortField}
          currentSortOrder={sortOrder}
          onSort={onSort}
          className="min-w-[80px]"
        >
          Qty
        </SortableTableHead>
        <SortableTableHead
          sortKey="category"
          currentSortField={sortField}
          currentSortOrder={sortOrder}
          onSort={onSort}
          className="min-w-[100px]"
        >
          Category
        </SortableTableHead>
        <SortableTableHead
          sortKey="status"
          currentSortField={sortField}
          currentSortOrder={sortOrder}
          onSort={onSort}
          className="min-w-[100px]"
        >
          Status
        </SortableTableHead>
        <SortableTableHead
          sortKey="due_date"
          currentSortField={sortField}
          currentSortOrder={sortOrder}
          onSort={onSort}
          className="min-w-[100px]"
        >
          Due Date
        </SortableTableHead>
        <SortableTableHead
          sortKey="current_stage"
          currentSortField={sortField}
          currentSortOrder={sortOrder}
          onSort={onSort}
          className="min-w-[100px]"
        >
          Current Stage
        </SortableTableHead>
        <TableHead className="w-32 font-medium">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
};
