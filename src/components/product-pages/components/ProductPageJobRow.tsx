
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Eye, FileText, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductPageJob } from "../types/ProductPageTypes";
import { useProductPageJobs } from "@/hooks/product-pages/useProductPageJobs";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProductPageJobRowProps {
  job: ProductPageJob;
  isSelected: boolean;
  onSelect: (jobId: string, isSelected: boolean) => void;
}

export function ProductPageJobRow({ job, isSelected, onSelect }: ProductPageJobRowProps) {
  const navigate = useNavigate();
  const { deleteJob } = useProductPageJobs();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Format date for display
  const formattedDueDate = format(new Date(job.due_date), "MMM d, yyyy");
  
  const handleViewDetails = () => {
    navigate(`/admin/product-pages/jobs/${job.id}`);
  };

  const handleViewPdf = () => {
    if (job.pdf_url) {
      window.open(job.pdf_url, "_blank");
    } else {
      toast.error("No PDF available for this job");
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteJob(job.id);
      toast.success("Job deleted successfully");
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error("Failed to delete job");
      console.error("Error deleting job:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <TableRow key={job.id}>
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(job.id, !!checked)}
            disabled={job.status !== "queued"}
          />
        </TableCell>
        <TableCell>{job.job_number}</TableCell>
        <TableCell className="max-w-[200px] truncate" title={job.name}>
          {job.name}
        </TableCell>
        <TableCell>{job.template_id}</TableCell>
        <TableCell>{job.quantity}</TableCell>
        <TableCell>{formattedDueDate}</TableCell>
        <TableCell>
          <div className="flex justify-start">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                job.status === "queued"
                  ? "bg-blue-100 text-blue-800"
                  : job.status === "batched"
                  ? "bg-amber-100 text-amber-800"
                  : job.status === "completed"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {job.status}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewPdf}
              disabled={!job.pdf_url}
            >
              <FileText className="h-4 w-4" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleViewDetails}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Job
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the job
              and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
