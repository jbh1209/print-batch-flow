
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
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleViewJob = (jobId: string, pdfUrl: string) => {
    handlePdfAction(pdfUrl, 'view');
  };

  const handleEditJob = (jobId: string) => {
    navigate(`/batches/business-cards/jobs/edit/${jobId}`);
  };

  const handleDownloadPdf = () => {
    handlePdfAction(pdfUrl, 'download');
  };

  const handleDeleteJob = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("business_card_jobs")
        .delete()
        .eq("id", jobId);

      if (error) {
        throw error;
      }

      sonnerToast.success("Job deleted successfully");
      if (onJobDeleted) {
        onJobDeleted();
      }
    } catch (error) {
      console.error("Error deleting job:", error);
      toast({
        title: "Error deleting job",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal size={16} />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleViewJob(jobId, pdfUrl)} className="flex items-center gap-2">
            <Eye size={16} />
            <span>View PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleEditJob(jobId)} className="flex items-center gap-2">
            <Pencil size={16} />
            <span>Edit</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadPdf} className="flex items-center gap-2">
            <Download size={16} />
            <span>Download PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
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
              {isDeleting ? (
                <>
                  <span className="animate-spin mr-2">○</span>
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default JobActions;
