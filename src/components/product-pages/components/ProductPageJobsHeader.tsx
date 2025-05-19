
import { Checkbox } from "@/components/ui/checkbox";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProductPageJobsHeaderProps {
  onSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  selectableJobsCount: number;
}

export function ProductPageJobsHeader({ 
  onSelectAll, 
  allSelected,
  selectableJobsCount 
}: ProductPageJobsHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-10">
          <Checkbox 
            checked={allSelected} 
            onCheckedChange={onSelectAll}
            disabled={selectableJobsCount === 0}
          />
        </TableHead>
        <TableHead className="whitespace-nowrap">Job Number</TableHead>
        <TableHead className="whitespace-nowrap">Name</TableHead>
        <TableHead className="whitespace-nowrap">Template</TableHead>
        <TableHead className="whitespace-nowrap">Quantity</TableHead>
        <TableHead className="whitespace-nowrap">Due Date</TableHead>
        <TableHead className="whitespace-nowrap">Status</TableHead>
        <TableHead className="whitespace-nowrap">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
}
