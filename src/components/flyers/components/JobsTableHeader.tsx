
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface JobsTableHeaderProps {
  onSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  selectableJobsCount: number;
}

export const JobsTableHeader = ({ 
  onSelectAll, 
  allSelected, 
  selectableJobsCount 
}: JobsTableHeaderProps) => {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-12">
          <Checkbox 
            checked={allSelected && selectableJobsCount > 0} 
            onCheckedChange={onSelectAll}
            disabled={selectableJobsCount === 0}
          />
        </TableHead>
        <TableHead>Job Name</TableHead>
        <TableHead>Job #</TableHead>
        <TableHead>Size</TableHead>
        <TableHead>Paper</TableHead>
        <TableHead>Quantity</TableHead>
        <TableHead>Due Date</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="w-24">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
};
