
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BatchSummary } from "@/components/batches/types/BatchTypes";
import AllBatchesTable from "./AllBatchesTable";

interface AllBatchesTabsProps {
  currentBatches: BatchSummary[];
  completedBatches: BatchSummary[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  getBadgeVariant: (status: string) => "default" | "secondary" | "destructive" | "outline" | "success";
  getBatchUrl: (batch: BatchSummary) => string;
  handleBatchClick: (url: string) => void;
}

const AllBatchesTabs: React.FC<AllBatchesTabsProps> = ({
  currentBatches,
  completedBatches,
  activeTab,
  setActiveTab,
  getBadgeVariant,
  getBatchUrl,
  handleBatchClick
}) => {
  const handleViewDetails = (batchId: string) => {
    // Find the batch
    const batch = [...currentBatches, ...completedBatches].find(b => b.id === batchId);
    if (batch) {
      const url = getBatchUrl(batch);
      handleBatchClick(url);
    }
  };

  return (
    <Tabs defaultValue="current" value={activeTab} onValueChange={setActiveTab} className="mb-6">
      <TabsList className="mb-4">
        <TabsTrigger value="current">
          Current Batches ({currentBatches.length})
        </TabsTrigger>
        <TabsTrigger value="completed">
          Completed Batches ({completedBatches.length})
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="current" className="bg-white shadow rounded-lg">
        <AllBatchesTable 
          batches={currentBatches}
          onViewDetails={handleViewDetails}
          emptyMessage="No current batches"
          emptyDescription="There are no batches in progress."
        />
      </TabsContent>
      
      <TabsContent value="completed" className="bg-white shadow rounded-lg">
        <AllBatchesTable 
          batches={completedBatches}
          onViewDetails={handleViewDetails}
          emptyMessage="No completed batches"
          emptyDescription="No batches have been completed or sent to print yet."
        />
      </TabsContent>
    </Tabs>
  );
};

export default AllBatchesTabs;
