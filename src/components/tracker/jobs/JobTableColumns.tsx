
import React from "react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

interface JobTableColumnsProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: (selected: boolean) => void;
}

export const JobTableColumns: React.FC<JobTableColumnsProps> = ({
  selectedCount,
  totalCount,
  onSelectAll
}) => {
  return (
    <TableHeader>
      <TableRow className="border-b">
        <TableHead className="w-12 px-2">
          <Checkbox
            checked={selectedCount === totalCount && totalCount > 0}
            indeterminate={selectedCount > 0 && selectedCount < totalCount}
            onCheckedChange={onSelectAll}
          />
        </TableHead>
        <TableHead className="min-w-[120px] font-medium">WO Number</TableHead>
        <TableHead className="min-w-[120px] font-medium">Customer</TableHead>
        <TableHead className="min-w-[100px] font-medium">Reference</TableHead>
        <TableHead className="min-w-[80px] font-medium">Qty</TableHead>
        <TableHead className="min-w-[100px] font-medium">Category</TableHead>
        <TableHead className="min-w-[100px] font-medium">Status</TableHead>
        <TableHead className="min-w-[100px] font-medium">Due Date</TableHead>
        <TableHead className="min-w-[100px] font-medium">Current Stage</TableHead>
        <TableHead className="w-32 font-medium">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
};
