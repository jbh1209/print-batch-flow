
import React, { useState } from 'react';
import { useBatchesList } from "@/hooks/useBatchesList";
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from "lucide-react";
import AllBatchesHeader from '@/components/batches/AllBatchesHeader';
import AllBatchesTabs from '@/components/batches/AllBatchesTabs';
import { BatchSummary } from '@/components/batches/types/BatchTypes';

const AllBatches: React.FC = () => {
  const { batches, isLoading, error, fetchBatches, getBatchUrl } = useBatchesList();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("current");

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

  const handleBatchClick = (batchUrl: string) => {
    navigate(batchUrl);
  };
  
  const getBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
      case 'queued': return 'outline';
      case 'in_progress': return 'secondary';
      case 'sent_to_print': return 'secondary';
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };

  // Separate batches into current and completed
  const currentBatches = batches.filter(
    batch => !['completed', 'sent_to_print'].includes(batch.status)
  ) as BatchSummary[];
  
  const completedBatches = batches.filter(
    batch => ['completed', 'sent_to_print'].includes(batch.status)
  ) as BatchSummary[];

  return (
    <div className="container mx-auto py-6">
      <AllBatchesHeader />
      
      <AllBatchesTabs 
        currentBatches={currentBatches}
        completedBatches={completedBatches}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        getBadgeVariant={getBadgeVariant}
        getBatchUrl={getBatchUrl}
        handleBatchClick={handleBatchClick}
      />
    </div>
  );
};

export default AllBatches;
