
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { EnhancedProductionKanban } from "@/components/tracker/EnhancedProductionKanban";

interface TrackerProductionContext {
  activeTab: string;
  filters: any;
}

const TrackerProduction = () => {
  const context = useOutletContext<TrackerProductionContext>();
  const filters = context?.filters || {};

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/tracker" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Production Workflow</h1>
            <p className="text-gray-600">Monitor and manage multi-stage production workflows with real-time tracking</p>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Configure Stages
            </Button>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Initialize Workflow
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <EnhancedProductionKanban />
      </div>
    </div>
  );
};

export default TrackerProduction;
