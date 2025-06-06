
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnhancedOperatorJobCard } from "./EnhancedOperatorJobCard";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface UniversalKanbanColumnProps {
  stage: {
    stage_id: string;
    stage_name: string;
    stage_color: string;
  };
  jobs: AccessibleJob[];
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onJobClick: (job: AccessibleJob) => void;
  onRefresh?: () => void;
  stageInstances?: Record<string, any>;
}

export const UniversalKanbanColumn: React.FC<UniversalKanbanColumnProps> = ({
  stage,
  jobs,
  onStart,
  onComplete,
  onJobClick,
  onRefresh,
  stageInstances = {}
}) => {
  return (
    <Card className="h-full flex flex-col max-h-[calc(100vh-12rem)]">
      <CardHeader 
        className="flex-shrink-0 text-white"
        style={{ backgroundColor: stage.stage_color }}
      >
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <span className="truncate">{stage.stage_name}</span>
          <Badge variant="secondary" className="bg-white/20 text-white ml-2 flex-shrink-0">
            {jobs.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-2 sm:p-4">
        <div className="h-full overflow-y-auto">
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">No jobs in this stage</p>
              </div>
            ) : (
              jobs.map(job => (
                <EnhancedOperatorJobCard
                  key={job.job_id}
                  job={job}
                  onStart={onStart}
                  onComplete={onComplete}
                  onRefresh={onRefresh}
                  currentStageInstance={stageInstances[job.job_id]}
                />
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
