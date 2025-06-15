
import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings } from "lucide-react";

type MultiStageKanbanHeaderProps = {
  metrics: {
    uniqueJobs: number;
    activeStages: number;
    pendingStages: number;
  };
  lastUpdate: Date;
  onRefresh: () => void;
  onSettings: () => void;
  children?: React.ReactNode;
};

export const MultiStageKanbanHeader: React.FC<MultiStageKanbanHeaderProps> = ({
  metrics, lastUpdate, onRefresh, onSettings, children
}) => (
  <div className="mb-2">
    <div className="flex flex-wrap items-center justify-between gap-2 md:gap-4">
      <div className="flex flex-col gap-0">
        <h2 className="text-lg font-bold leading-5">Multi-Stage Kanban</h2>
        <span className="text-xs text-gray-600">Active jobs in production stages</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {children}
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-100 rounded text-blue-700">
          {metrics.uniqueJobs} jobs
        </span>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 rounded text-green-700">
          {metrics.activeStages} active stages
        </span>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-yellow-100 rounded text-yellow-700">
          {metrics.pendingStages} pending
        </span>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-100 rounded text-purple-700">
          {metrics.activeStages + metrics.pendingStages} total stages
        </span>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500">
          Last: {lastUpdate.toLocaleTimeString()}
        </span>
        <Button 
          variant="outline" size="sm"
          onClick={onRefresh}
          className="px-2 h-7"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="px-2 h-7" onClick={onSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
);
