import React, { useState, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { ProductionJobCard } from "../ProductionJobCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, RefreshCw, Eye, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import JobStageCard from "./JobStageCard";
import { getDueInfo } from "./getDueInfo";

interface StageColumnProps {
  stage: {
    id: string;
    name: string;
    color: string;
    order_index: number;
    description?: string;
    is_active: boolean;
    is_virtual?: boolean;
    is_multi_part: boolean;
    part_definitions: string[];
    master_queue_id?: string;
  };
  jobStages: any[];
  onStageAction: (stageId: string, action: 'start' | 'complete' | 'scan') => void;
  viewMode: 'card' | 'list';
  enableDnd: boolean;
  reorderRef: React.MutableRefObject<(newOrder: string[]) => void>;
  onReorder: (newOrder: string[]) => void;
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  layout?: "horizontal" | "vertical";
}

const StageColumn = ({ 
  stage, 
  jobStages, 
  onStageAction, 
  viewMode, 
  enableDnd,
  reorderRef,
  onReorder,
  selectedJobId,
  onSelectJob,
  layout = "horizontal"
}: StageColumnProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Set up droppable area
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  // Set up reorder ref for parent component
  React.useEffect(() => {
    reorderRef.current = (newOrder: string[]) => {
      onReorder(newOrder);
    };
  }, [onReorder, reorderRef]);

  // Prepare sortable items
  const sortableIds = jobStages.map(js => js.id);

  // Create due info map for all job stages
  const dueInfoMap = useMemo(() => {
    const map: Record<string, any> = {};
    jobStages.forEach(jobStage => {
      if (jobStage.production_job?.due_date) {
        map[jobStage.id] = getDueInfo(jobStage.production_job.due_date);
      }
    });
    return map;
  }, [jobStages]);

  // Calculate stage stats
  const activeJobs = jobStages.filter(js => js.status === 'active').length;
  const pendingJobs = jobStages.filter(js => js.status === 'pending').length;
  const urgentJobs = Object.values(dueInfoMap).filter((info: any) => info.warning).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh - in real app this would trigger a data reload
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const isJobHighlighted = (jobStage: any) => {
    return jobStage.production_job?.highlighted || false;
  };

  // Sequential workflow - no concurrent groups, just regular job stages
  const regularJobStages = jobStages;

  return (
    <Card className={cn(
      "flex-shrink-0 transition-all duration-200",
      layout === "horizontal" ? "w-80" : "w-full mb-4",
      isOver && "ring-2 ring-blue-500 shadow-lg",
      stage.is_virtual && "border-orange-200 bg-orange-50/50"
    )}>
      <CardHeader className="pb-3 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-6 w-6 p-0 shrink-0"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            
            <CardTitle className="text-sm font-medium truncate">
              {stage.name}
            </CardTitle>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {urgentJobs > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {urgentJobs}
              </Badge>
            )}
            
            <Badge 
              variant={activeJobs > 0 ? "default" : "secondary"} 
              className="h-5 px-1.5 text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              {activeJobs}
            </Badge>
            
            <Badge variant="outline" className="h-5 px-1.5 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {pendingJobs}
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        {stage.description && !isCollapsed && (
          <p className="text-xs text-muted-foreground mt-1">
            {stage.description}
          </p>
        )}
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0">
          <div
            ref={setNodeRef}
            className={cn(
              "transition-all duration-200",
              layout === "horizontal" ? "min-h-[400px]" : "min-h-[200px]",
              isOver && "bg-blue-50 rounded-lg"
            )}
          >
            <div className="flex flex-col gap-1">
              {/* Sequential workflow - basic job stage display */}
              {regularJobStages.map((jobStage) => (
                <div key={jobStage.id} className="p-2 border rounded">
                  {jobStage.production_job?.wo_no || 'Unknown Job'}
                </div>
              ))}
              
              {/* Remove SortableContext for now - DnD disabled */}
              
              {jobStages.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {isOver ? "Drop jobs here" : "No jobs in this stage"}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default StageColumn;