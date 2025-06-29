
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
        editPath = `/batchflow/batches/business-cards/jobs/${job.id}/edit`;
        break;
      case 'Flyers':
        editPath = `/batchflow/batches/flyers/jobs/${job.id}/edit`;
        break;
      case 'Postcards':
        editPath = `/batchflow/batches/postcards/jobs/${job.id}/edit`;
        break;
      case 'Posters':
        editPath = `/batchflow/batches/posters/jobs/${job.id}/edit`;
        break;
      case 'Sleeves':
        editPath = `/batchflow/batches/sleeves/jobs/${job.id}/edit`;
        break;
      case 'Boxes':
        editPath = `/batchflow/batches/boxes/jobs/${job.id}/edit`;
        break;
      case 'Covers':
        editPath = `/batchflow/batches/covers/jobs/${job.id}/edit`;
        break;
      case 'Stickers':
        editPath = `/batchflow/batches/stickers/jobs/${job.id}/edit`;
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
      
      // Create a type-safe query based on the table name
      let originalJob: any = null;
      let error: any = null;

      switch (tableName) {
        case 'business_card_jobs':
          const bcResult = await supabase
            .from('business_card_jobs')
            .select('*')
            .eq('id', job.id)
            .single();
          originalJob = bcResult.data;
          error = bcResult.error;
          break;
        case 'flyer_jobs':
          const flyerResult = await supabase
            .from('flyer_jobs')
            .select('*')
            .eq('id', job.id)
            .single();
          originalJob = flyerResult.data;
          error = flyerResult.error;
          break;
        case 'postcard_jobs':
          const postcardResult = await supabase
            .from('postcard_jobs')
            .select('*')
            .eq('id', job.id)
            .single();
          originalJob = postcardResult.data;
          error = postcardResult.error;
          break;
        case 'poster_jobs':
          const posterResult = await supabase
            .from('poster_jobs')
            .select('*')
            .eq('id', job.id)
            .single();
          originalJob = posterResult.data;
          error = posterResult.error;
          break;
        case 'sleeve_jobs':
          const sleeveResult = await supabase
            .from('sleeve_jobs')
            .select('*')
            .eq('id', job.id)
            .single();
          originalJob = sleeveResult.data;
          error = sleeveResult.error;
          break;
        case 'box_jobs':
          const boxResult = await supabase
            .from('box_jobs')
            .select('*')
            .eq('id', job.id)
            .single();
          originalJob = boxResult.data;
          error = boxResult.error;
          break;
        case 'cover_jobs':
          const coverResult = await supabase
            .from('cover_jobs')
            .select('*')
            .eq('id', job.id)
            .single();
          originalJob = coverResult.data;
          error = coverResult.error;
          break;
        case 'sticker_jobs':
          const stickerResult = await supabase
            .from('sticker_jobs')
            .select('*')
            .eq('id', job.id)
            .single();
          originalJob = stickerResult.data;
          error = stickerResult.error;
          break;
        default:
          throw new Error(`Unknown table: ${tableName}`);
      }

      if (error) {
        console.error("Error fetching job:", error);
        throw new Error("Failed to fetch original job data");
      }

      if (!originalJob) {
        throw new Error("Original job not found");
      }

      // Prepare the duplicate data by removing fields that should be auto-generated
      const { id, created_at, updated_at, ...jobData } = originalJob;
      
      const duplicateData = {
        ...jobData,
        job_number: `${originalJob.job_number}-COPY-${Date.now().toString().slice(-4)}`,
        name: `${originalJob.name} (Copy)`,
        status: 'queued',
        batch_id: null,
      };

      // Insert the duplicate using the same type-safe approach
      switch (tableName) {
        case 'business_card_jobs':
          const bcInsertResult = await supabase
            .from('business_card_jobs')
            .insert(duplicateData);
          if (bcInsertResult.error) throw bcInsertResult.error;
          break;
        case 'flyer_jobs':
          const flyerInsertResult = await supabase
            .from('flyer_jobs')
            .insert(duplicateData);
          if (flyerInsertResult.error) throw flyerInsertResult.error;
          break;
        case 'postcard_jobs':
          const postcardInsertResult = await supabase
            .from('postcard_jobs')
            .insert(duplicateData);
          if (postcardInsertResult.error) throw postcardInsertResult.error;
          break;
        case 'poster_jobs':
          const posterInsertResult = await supabase
            .from('poster_jobs')
            .insert(duplicateData);
          if (posterInsertResult.error) throw posterInsertResult.error;
          break;
        case 'sleeve_jobs':
          const sleeveInsertResult = await supabase
            .from('sleeve_jobs')
            .insert(duplicateData);
          if (sleeveInsertResult.error) throw sleeveInsertResult.error;
          break;
        case 'box_jobs':
          const boxInsertResult = await supabase
            .from('box_jobs')
            .insert(duplicateData);
          if (boxInsertResult.error) throw boxInsertResult.error;
          break;
        case 'cover_jobs':
          const coverInsertResult = await supabase
            .from('cover_jobs')
            .insert(duplicateData);
          if (coverInsertResult.error) throw coverInsertResult.error;
          break;
        case 'sticker_jobs':
          const stickerInsertResult = await supabase
            .from('sticker_jobs')
            .insert(duplicateData);
          if (stickerInsertResult.error) throw stickerInsertResult.error;
          break;
      }

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
      
      // Use type-safe delete operations
      switch (tableName) {
        case 'business_card_jobs':
          const bcResult = await supabase
            .from('business_card_jobs')
            .delete()
            .eq("id", job.id);
          if (bcResult.error) throw bcResult.error;
          break;
        case 'flyer_jobs':
          const flyerResult = await supabase
            .from('flyer_jobs')
            .delete()
            .eq("id", job.id);
          if (flyerResult.error) throw flyerResult.error;
          break;
        case 'postcard_jobs':
          const postcardResult = await supabase
            .from('postcard_jobs')
            .delete()
            .eq("id", job.id);
          if (postcardResult.error) throw postcardResult.error;
          break;
        case 'poster_jobs':
          const posterResult = await supabase
            .from('poster_jobs')
            .delete()
            .eq("id", job.id);
          if (posterResult.error) throw posterResult.error;
          break;
        case 'sleeve_jobs':
          const sleeveResult = await supabase
            .from('sleeve_jobs')
            .delete()
            .eq("id", job.id);
          if (sleeveResult.error) throw sleeveResult.error;
          break;
        case 'box_jobs':
          const boxResult = await supabase
            .from('box_jobs')
            .delete()
            .eq("id", job.id);
          if (boxResult.error) throw boxResult.error;
          break;
        case 'cover_jobs':
          const coverResult = await supabase
            .from('cover_jobs')
            .delete()
            .eq("id", job.id);
          if (coverResult.error) throw coverResult.error;
          break;
        case 'sticker_jobs':
          const stickerResult = await supabase
            .from('sticker_jobs')
            .delete()
            .eq("id", job.id);
          if (stickerResult.error) throw stickerResult.error;
          break;
        default:
          throw new Error(`Unknown table: ${tableName}`);
      }

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
      <DropdownMenu modal={false}>
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
            onSelect={(e) => e.preventDefault()}
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
