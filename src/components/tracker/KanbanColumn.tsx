
import React, { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductionJobCard } from "./ProductionJobCard";
import { calculateAndFormatStageTime } from "@/utils/tracker/stageTimeCalculations";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface ProductionJob extends AccessibleJob {
  highlighted?: boolean;
  qr_code_data?: string;
  qr_code_url?: string;
  so_no?: string;
  location?: string;
}

interface KanbanColumnProps {
  id: string;
  title: string;
  jobs: ProductionJob[];
  colorClass: string;
}

export const KanbanColumn = ({ id, title, jobs, colorClass }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  // Calculate total time for this stage
  const totalTime = useMemo(() => {
    return calculateAndFormatStageTime(jobs);
  }, [jobs]);

  return (
    <div className="flex-shrink-0 w-80">
      <Card className={`h-full ${isOver ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span>{title}</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-medium">
                {totalTime}
              </Badge>
              <Badge className={colorClass}>
                {jobs.length}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={setNodeRef}
            className="space-y-3 min-h-[400px]"
          >
            <SortableContext 
              items={jobs.map(job => job.id)} 
              strategy={verticalListSortingStrategy}
            >
              {jobs.map((job) => (
                <ProductionJobCard key={job.id} job={job} />
              ))}
            </SortableContext>
            {jobs.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                Drop jobs here
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
