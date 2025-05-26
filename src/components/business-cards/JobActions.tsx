
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
import { supabase } from "@/integrations/supabase/client";
import { toast as sonnerToast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, Eye, Download } from "lucide-react";
import { handlePdfAction } from "@/utils/pdfActionUtils";

interface JobActionsProps {
  jobId: string;
  pdfUrl: string;
  onJobDeleted?: () => void;
}

const JobActions = ({ jobId, pdfUrl, onJobDeleted }: JobActionsProps) => {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      navigate(`/batches/business-cards/jobs/edit/${jobId}`);
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
    if (isDeleting) return;
    
    setIsDeleting(true);
    
    try {
      console.log("Starting deletion for job:", jobId);
      
      // Close dialog immediately
      setShowDeleteDialog(false);
      
      // Delete from database
      const { error } = await supabase
        .from('business_card_jobs')
        .delete()
        .eq('id', jobId);
      
      if (error) {
        console.error("Database deletion error:", error);
        throw new Error(`Database error: ${error.message}`);
      }
      
      console.log("Job deleted successfully from database");
      sonnerToast.success("Job deleted successfully");
      
      // Trigger refresh if callback provided
      if (onJobDeleted) {
        setTimeout(() => {
          onJobDeleted();
        }, 100);
      }
      
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
          <Button variant="ghost" size="sm" disabled={isDeleting}>
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
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
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
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteJob} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default JobActions;
