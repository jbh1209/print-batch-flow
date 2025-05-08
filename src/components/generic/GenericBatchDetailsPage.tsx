import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ProductConfig, BaseBatch, BaseJob } from '@/config/productTypes';
import GenericBatchDetails from './GenericBatchDetails';
import DeleteBatchDialog from '@/components/batches/DeleteBatchDialog';
import { castToUUID, safeBatchId } from '@/utils/database/dbHelpers';
import { adaptBatchFromDb, adaptJobArrayFromDb } from '@/utils/database/typeAdapters';
import { useAuth } from '@/hooks/useAuth';
import { createUpdateData } from '@/utils/database/dbHelpers';

interface GenericBatchDetailsPageProps {
  config: ProductConfig;
  backUrl: string;
}

const GenericBatchDetailsPage = ({ config, backUrl }: GenericBatchDetailsPageProps) => {
  const { user } = useAuth();
  const { batchId = '' } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  
  const [batch, setBatch] = useState<BaseBatch | null>(null);
  const [jobs, setJobs] = useState<BaseJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // For deletion handling
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [batchToDelete, setBatchToDelete] = useState<BaseBatch | null>(null);

  const fetchBatchAndJobs = async () => {
    if (!user || !batchId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch batch details
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', castToUUID(batchId))
        .eq('created_by', castToUUID(user.id))
        .single();
      
      if (batchError) {
        throw batchError;
      }
      
      // Use adapter to safely convert to BaseBatch
      const processedBatch = adaptBatchFromDb<BaseBatch>(batchData);
      
      if (!processedBatch) {
        throw new Error("Failed to process batch data");
      }
      
      setBatch(processedBatch);
      
      // Fetch related jobs if we have a table name
      if (config.tableName) {
        const { data: jobsData, error: jobsError } = await supabase
          .from(config.tableName as any)
          .select('*')
          .eq('batch_id', castToUUID(batchId));
          
        if (jobsError) {
          throw jobsError;
        }
        
        // Use adapter to safely convert to BaseJob array
        const processedJobs = adaptJobArrayFromDb<BaseJob>(jobsData);
        setJobs(processedJobs);
      }
    } catch (err) {
      console.error("Error fetching batch details:", err);
      setError("Failed to load batch details or related jobs");
      toast.error("Error loading batch details");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load batch and jobs on component mount
  useEffect(() => {
    fetchBatchAndJobs();
  }, [batchId, user]);
  
  // Handle viewing PDF
  const handleViewPDF = (url: string | null) => {
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error("No PDF available for this batch");
    }
  };
  
  // Handle batch deletion
  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    
    setIsDeleting(true);
    try {
      // First update jobs to remove batch_id
      if (config.tableName) {
        const { error: updateError } = await supabase
          .from(config.tableName as any)
          .update(createUpdateData({ 
            status: 'queued',
            batch_id: null
          }))
          .eq('batch_id', castToUUID(batchToDelete.id));
          
        if (updateError) {
          throw updateError;
        }
      }
      
      // Then delete the batch
      const { error: deleteError } = await supabase
        .from('batches')
        .delete()
        .eq('id', castToUUID(batchToDelete.id));
        
      if (deleteError) {
        throw deleteError;
      }
      
      toast.success("Batch deleted successfully");
      navigate(backUrl);
    } catch (err) {
      console.error("Error deleting batch:", err);
      toast.error("Failed to delete batch");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  
  const handleOpenDeleteDialog = (selectedBatch: BaseBatch) => {
    setBatchToDelete(selectedBatch);
    setShowDeleteDialog(true);
  };

  return (
    <>
      <GenericBatchDetails
        batch={batch}
        batchId={batchId}
        isLoading={isLoading}
        error={error}
        jobs={jobs}
        backUrl={backUrl}
        productType={config.productType}
        onViewPDF={handleViewPDF}
        onDeleteBatch={handleOpenDeleteDialog}
      />
      
      {/* Delete confirmation dialog */}
      {batch && (
        <DeleteBatchDialog
          isOpen={showDeleteDialog}
          isDeleting={isDeleting}
          batchName={batch.name}
          onClose={() => setShowDeleteDialog(false)}
          onConfirmDelete={handleDeleteBatch}
        />
      )}
    </>
  );
};

export default GenericBatchDetailsPage;
