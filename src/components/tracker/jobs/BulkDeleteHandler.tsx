
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BulkDeleteConfirmDialog } from "./BulkDeleteConfirmDialog";

interface BulkDeleteHandlerProps {
  selectedJobs: (string | { id: string })[];
  onDeleteComplete: () => void;
  children: (props: {
    showDialog: boolean;
    isDeleting: boolean;
    onShowDialog: () => void;
    onConfirmDelete: () => Promise<void>;
    onCloseDialog: () => void;
  }) => React.ReactNode;
}

export const BulkDeleteHandler: React.FC<BulkDeleteHandlerProps> = ({
  selectedJobs,
  onDeleteComplete,
  children
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const jobIds = selectedJobs.map(job => typeof job === 'string' ? job : job.id);
      
      // Use RPC function for production_jobs to avoid cascade conflicts
      const { data, error } = await supabase.rpc('delete_production_jobs', {
        job_ids: jobIds
      });

      if (error) throw error;

      // Check if the RPC succeeded
      if (data && !(data as any).success) {
        throw new Error((data as any).error || 'Failed to delete jobs');
      }

      toast.success(`Successfully deleted ${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''}`);
      setShowDialog(false);
      onDeleteComplete();
    } catch (err) {
      console.error('Error deleting jobs:', err);
      toast.error('Failed to delete jobs');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {children({
        showDialog,
        isDeleting,
        onShowDialog: () => setShowDialog(true),
        onConfirmDelete: handleConfirmDelete,
        onCloseDialog: () => setShowDialog(false)
      })}
      
      <BulkDeleteConfirmDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onConfirm={handleConfirmDelete}
        jobCount={selectedJobs.length}
        isDeleting={isDeleting}
      />
    </>
  );
};
