
import React, { useState } from 'react';
import { useBatchesList } from "@/hooks/useBatchesList";
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from "lucide-react";
import AllBatchesHeader from '@/components/batches/AllBatchesHeader';
import AllBatchesTabs from '@/components/batches/AllBatchesTabs';
import { BatchSummary } from '@/components/batches/types/BatchTypes';
import { useBatchOperations } from "@/context/BatchOperationsContext";
import { BatchDeleteConfirmation } from "@/components/generic/batch-list/BatchDeleteConfirmation";

const AllBatches: React.FC = () => {
  const { batches, isLoading, error, fetchBatches, getBatchUrl } = useBatchesList();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("current");
  
  const {
    batchBeingDeleted,
    isDeletingBatch,
    deleteBatch,
    setBatchBeingDeleted
  } = useBatchOperations();
  
  // Handler for batch deletion
  const handleDeleteBatch = async () => {
    if (!batchBeingDeleted) return;
    
    const batchToDelete = batches.find(b => b.id === batchBeingDeleted);
    if (!batchToDelete) {
      console.error("Batch not found for deletion:", batchBeingDeleted);
      return;
    }
    
    const success = await deleteBatch(
      batchBeingDeleted,
      batchToDelete.product_type,
      "/batches"
    );
    
    if (success) {
      // Refresh the batches list
      fetchBatches();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading batches...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">There was a problem loading batches</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Convert batches to our local BatchSummary type with all required fields
  const typedBatches: BatchSummary[] = batches.map(batch => ({
    id: batch.id,
    name: batch.name,
    status: batch.status,
    product_type: batch.product_type,
    due_date: batch.due_date,
    created_at: batch.created_at || new Date().toISOString(),
    // Add the required fields that might be missing in the fetched data
    sheets_required: batch.sheets_required || 0,
    lamination_type: batch.lamination_type || "none",
    front_pdf_url: batch.front_pdf_url || null,
    back_pdf_url: batch.back_pdf_url || null
  }));

  // Separate batches into current and completed
  const currentBatches = typedBatches.filter(
    batch => !['completed', 'sent_to_print'].includes(String(batch.status))
  );
  
  const completedBatches = typedBatches.filter(
    batch => ['completed', 'sent_to_print'].includes(String(batch.status))
  );

  // Create a wrapper for getBatchUrl that works with our typed BatchSummary
  const getTypedBatchUrl = (batch: BatchSummary): string => getBatchUrl(batch);
  
  // Find the name of the batch being deleted
  const batchToDeleteName = typedBatches.find(b => b.id === batchBeingDeleted)?.name;

  return (
    <div className="container mx-auto py-6">
      <AllBatchesHeader />
      
      <AllBatchesTabs 
        currentBatches={currentBatches}
        completedBatches={completedBatches}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        getBadgeVariant={getBadgeVariant}
        getBatchUrl={getTypedBatchUrl}
        handleBatchClick={handleBatchClick}
        handleDeleteBatch={setBatchBeingDeleted}
      />
      
      {/* Delete Confirmation Dialog */}
      <BatchDeleteConfirmation 
        batchToDelete={batchBeingDeleted}
        onCancel={() => setBatchBeingDeleted(null)}
        onDelete={handleDeleteBatch}
        batchName={batchToDeleteName}
      />
    </div>
  );
  
  function getBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" | "success" {
    switch (status) {
      case 'queued': return 'outline';
      case 'in_progress': return 'secondary';
      case 'sent_to_print': return 'secondary';
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  }

  function handleBatchClick(batchUrl: string) {
    navigate(batchUrl);
  }
};

export default AllBatches;
