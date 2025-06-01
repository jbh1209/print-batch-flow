
import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BulkDeleteConfirmDialog } from "./BulkDeleteConfirmDialog";

interface BulkDeleteHandlerProps {
  selectedJobs: string[];
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
      const { error } = await supabase
        .from('production_jobs')
        .delete()
        .in('id', selectedJobs);

      if (error) throw error;

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
