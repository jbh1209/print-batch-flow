
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Workflow, LayoutGrid, Layers } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductionKanban } from "@/components/tracker/ProductionKanban";
import { EnhancedProductionKanban } from "@/components/tracker/EnhancedProductionKanban";
import { MultiStageKanban } from "@/components/tracker/MultiStageKanban";
import { useProductionDataContext } from "@/contexts/ProductionDataContext";

const TrackerKanban = () => {
  const [activeTab, setActiveTab] = useState("multistage");
  
  // Use cached production data instead of separate kanban data
  const { jobs, consolidatedStages, stages, isLoading, error, refresh } = useProductionDataContext();

  return (
    <div className="h-full flex flex-col">
      {/* Remove external sidebar here */}
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Production Kanban Board</h1>
            <p className="text-gray-600">Manage jobs through production workflows</p>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Total jobs: {jobs.length} | Active stages: {consolidatedStages.filter(s => s.is_active !== false).length}
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="multistage" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Multi-Stage
          </TabsTrigger>
          <TabsTrigger value="enhanced" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Enhanced
          </TabsTrigger>
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Basic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="multistage" className="flex-1 overflow-hidden mt-4">
          <MultiStageKanban 
            jobs={jobs}
            stages={stages}
            isLoading={isLoading}
            error={error}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="enhanced" className="flex-1 overflow-hidden mt-4">
          <EnhancedProductionKanban 
            jobs={jobs}
            stages={stages}
            isLoading={isLoading}
            error={error}
            onRefresh={refresh}
          />
        </TabsContent>

        <TabsContent value="basic" className="flex-1 overflow-hidden mt-4">
          <ProductionKanban 
            jobs={jobs}
            isLoading={isLoading}
            error={error}
            onRefresh={refresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TrackerKanban;
