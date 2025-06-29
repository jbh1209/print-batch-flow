import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
import { toast as sonnerToast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, Eye, Download } from "lucide-react";
import { handlePdfAction } from "@/utils/pdfActionUtils";

interface JobActionsProps {
  jobId: string;
  pdfUrl: string;
  onJobDeleted: (jobId: string) => Promise<void>;
  isDeleting?: boolean;
}

const JobActions = ({ jobId, pdfUrl, onJobDeleted, isDeleting = false }: JobActionsProps) => {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting_, setIsDeleting] = useState(false);

  const currentlyDeleting = isDeleting || isDeleting_;

  const handleViewJob = () => {
    try {
      handlePdfAction(pdfUrl, 'view');
    } catch (error) {
      console.error("Error viewing job:", error);
      sonnerToast.error("Failed to view PDF");
    }
  };

  const handleEditJob = () => {
    try {
      navigate(`/batchflow/batches/business-cards/jobs/${jobId}/edit`);
    } catch (error) {
      console.error("Error navigating to edit:", error);
      sonnerToast.error("Failed to open edit page");
    }
  };

  const handleDownloadPdf = () => {
    try {
      handlePdfAction(pdfUrl, 'download');
    } catch (error) {
      console.error("Error downloading PDF:", error);
      sonnerToast.error("Failed to download PDF");
    }
  };

  const handleDeleteJob = async () => {
    if (currentlyDeleting) return;
    
    setIsDeleting(true);
    
    try {
      await onJobDeleted(jobId);
      setShowDeleteDialog(false);
      sonnerToast.success("Job deleted successfully");
    } catch (error) {
      console.error("Job deletion failed:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      sonnerToast.error(`Failed to delete job: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={currentlyDeleting}>
            <MoreHorizontal size={16} />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleViewJob} className="flex items-center gap-2">
            <Eye size={16} />
            <span>View PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleEditJob} className="flex items-center gap-2">
            <Pencil size={16} />
            <span>Edit</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadPdf} className="flex items-center gap-2">
            <Download size={16} />
            <span>Download PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onSelect={(e) => e.preventDefault()}
            onClick={() => setShowDeleteDialog(true)}
            disabled={currentlyDeleting}
            className="flex items-center gap-2 text-red-600 focus:text-red-600"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this 
              business card job and remove the files from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={currentlyDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteJob} 
              disabled={currentlyDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {currentlyDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default JobActions;
