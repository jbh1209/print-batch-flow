
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { ConsolidatedStage } from "@/utils/tracker/stageConsolidation";
import { UniversalJobCard } from "./UniversalJobCard";
import { JobListView } from "@/components/tracker/common/JobListView";

interface StageKanbanColumnProps {
  stage: ConsolidatedStage;
  jobs: AccessibleJob[];
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  viewMode: 'card' | 'list';
}

export const StageKanbanColumn: React.FC<StageKanbanColumnProps> = ({
  stage,
  jobs,
  onStart,
  onComplete,
  viewMode
}) => {
  const activeJobs = jobs.filter(job => job.current_stage_status === 'active');
  const pendingJobs = jobs.filter(job => job.current_stage_status === 'pending');

  return (
    <Card className="h-fit">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.stage_color }}
            />
            {stage.stage_name}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {jobs.length}
          </Badge>
        </div>
        
        {/* Stage Statistics */}
        <div className="flex items-center gap-2 text-xs">
          {activeJobs.length > 0 && (
            <Badge variant="default" className="text-xs bg-blue-500">
              {activeJobs.length} Active
            </Badge>
          )}
          {pendingJobs.length > 0 && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
              {pendingJobs.length} Pending
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {jobs.length > 0 ? (
          viewMode === 'card' ? (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {jobs.map(job => (
                <UniversalJobCard
                  key={job.job_id}
                  job={job}
                  onStart={onStart}
                  onComplete={onComplete}
                />
              ))}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <JobListView
                jobs={jobs}
                onStart={onStart}
                onComplete={onComplete}
              />
            </div>
          )
        ) : (
          <div className="text-center py-6 text-gray-400 text-sm">
            No jobs in this stage
          </div>
        )}
      </CardContent>
    </Card>
  );
};
