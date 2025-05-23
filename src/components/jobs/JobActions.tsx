
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
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
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, Eye, Download, Copy } from "lucide-react";
import { handlePdfAction } from "@/utils/pdfActionUtils";
import { ExtendedJob } from "@/hooks/useAllPendingJobs";

interface JobActionsProps {
  job: ExtendedJob;
  onJobDeleted?: () => void;
  onJobUpdated?: () => void;
}

const JobActions = ({ job, onJobDeleted, onJobUpdated }: JobActionsProps) => {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleViewJob = () => {
    if (job.pdf_url) {
      handlePdfAction(job.pdf_url, 'view');
    } else {
      toast.error("No PDF available to view");
    }
  };

  const handleEditJob = () => {
    let editPath: string;
    
    switch (job.productConfig?.productType) {
      case 'Business Cards':
        editPath = `/batches/business-cards/jobs/edit/${job.id}`;
        break;
      case 'Flyers':
        editPath = `/batches/flyers/jobs/edit/${job.id}`;
        break;
      case 'Postcards':
        editPath = `/batches/postcards/jobs/edit/${job.id}`;
        break;
      case 'Posters':
        editPath = `/batches/posters/jobs/edit/${job.id}`;
        break;
      case 'Sleeves':
        editPath = `/batches/sleeves/jobs/edit/${job.id}`;
        break;
      case 'Boxes':
        editPath = `/batches/boxes/jobs/edit/${job.id}`;
        break;
      case 'Covers':
        editPath = `/batches/covers/jobs/edit/${job.id}`;
        break;
      case 'Stickers':
        editPath = `/batches/stickers/jobs/edit/${job.id}`;
        break;
      default:
        toast.error(`Edit functionality not available for ${job.productConfig?.productType}`);
        return;
    }
    
    navigate(editPath);
  };

  const handleDownloadPdf = () => {
    if (job.pdf_url) {
      handlePdfAction(job.pdf_url, 'download');
    } else {
      toast.error("No PDF available to download");
    }
  };

  const handleDuplicateJob = async () => {
    setIsDuplicating(true);
    try {
      const tableName = job.productConfig.tableName;
      
      // Get the original job data
      const { data: originalJob, error: fetchError } = await supabase
        .from(tableName as any)
        .select('*')
        .eq('id', job.id)
        .single();

      if (fetchError) throw fetchError;

      // Prepare the duplicate data
      const duplicateData = {
        ...originalJob,
        id: undefined, // Let the database generate a new ID
        job_number: `${originalJob.job_number}-COPY-${Date.now().toString().slice(-4)}`,
        name: `${originalJob.name} (Copy)`,
        status: 'queued',
        batch_id: null,
        created_at: undefined,
        updated_at: undefined
      };

      // Insert the duplicate
      const { error: insertError } = await supabase
        .from(tableName as any)
        .insert(duplicateData);

      if (insertError) throw insertError;

      toast.success("Job duplicated successfully");
      if (onJobUpdated) {
        onJobUpdated();
      }
    } catch (error) {
      console.error("Error duplicating job:", error);
      toast.error("Failed to duplicate job");
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleDeleteJob = async () => {
    setIsDeleting(true);
    try {
      const tableName = job.productConfig.tableName;
      
      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq("id", job.id);

      if (error) throw error;

      toast.success("Job deleted successfully");
      if (onJobDeleted) {
        onJobDeleted();
      }
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error("Failed to delete job");
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
          <DropdownMenuItem onClick={handleViewJob} className="flex items-center gap-2">
            <Eye size={16} />
            <span>View PDF</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadPdf} className="flex items-center gap-2">
            <Download size={16} />
            <span>Download PDF</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleEditJob} className="flex items-center gap-2">
            <Pencil size={16} />
            <span>Edit Job</span>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleDuplicateJob} 
            disabled={isDuplicating}
            className="flex items-center gap-2"
          >
            <Copy size={16} />
            <span>{isDuplicating ? 'Duplicating...' : 'Duplicate Job'}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="flex items-center gap-2 text-red-600 focus:text-red-600"
          >
            <Trash2 size={16} />
            <span>Delete Job</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{job.name}"? This action cannot be undone and will permanently remove the job and its files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteJob} 
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Deleting..." : "Delete Job"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default JobActions;
