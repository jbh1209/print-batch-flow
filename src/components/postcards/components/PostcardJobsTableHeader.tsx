
import { TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const PostcardJobsTableHeader = () => {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Client Name</TableHead>
        <TableHead>Job Number</TableHead>
        <TableHead>Size</TableHead>
        <TableHead>Paper</TableHead>
        <TableHead>Lamination</TableHead>
        <TableHead>Quantity</TableHead>
        <TableHead>Due Date</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );
};
