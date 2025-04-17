
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { FlyerJob } from "@/components/batches/types/FlyerTypes";

interface FlyerJobsTableContainerProps {
  children: React.ReactNode;
  showPagination?: boolean;
}

export const FlyerJobsTableContainer = ({ 
  children,
  showPagination = true
}: FlyerJobsTableContainerProps) => {
  return (
    <>
      <div className="overflow-x-auto">
        {children}
      </div>
      
      {showPagination && (
        <div className="p-4 border-t">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>1</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </>
  );
};
