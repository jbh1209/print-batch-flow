
import { TableRow, TableCell } from "@/components/ui/table";

interface EmptyJobsMessageProps {
  colSpan: number;
  message?: string;
}

export const EmptyJobsMessage = ({ 
  colSpan, 
  message = "No jobs match the current filter" 
}: EmptyJobsMessageProps) => {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
};
