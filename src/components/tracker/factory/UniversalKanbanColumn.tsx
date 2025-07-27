
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnhancedOperatorJobCard } from "./EnhancedOperatorJobCard";
import { calculateAndFormatStageTime } from "@/utils/tracker/stageTimeCalculations";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface StageInstanceData {
  id: string;
  job_id: string;
  production_stage_id: string;
  status: string;
  proof_emailed_at?: string;
  client_email?: string;
  client_name?: string;
  proof_pdf_url?: string;
  updated_at?: string;
  production_stage?: {
    name: string;
  };
}

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
  getStageInstanceForJob: (job: AccessibleJob) => StageInstanceData | undefined;
}

export const UniversalKanbanColumn: React.FC<UniversalKanbanColumnProps> = ({
  stage,
  jobs,
  onStart,
  onComplete,
  onJobClick,
  onRefresh,
  getStageInstanceForJob
}) => {
  // Calculate total time for this stage
  const totalTime = useMemo(() => {
    return calculateAndFormatStageTime(jobs);
  }, [jobs]);

  return (
    <Card className="h-full flex flex-col max-h-[calc(100vh-12rem)]">
      <CardHeader 
        className="flex-shrink-0 text-white"
        style={{ backgroundColor: stage.stage_color }}
      >
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <span className="truncate">{stage.stage_name}</span>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            <Badge variant="secondary" className="bg-white/30 text-white text-xs font-medium">
              {totalTime}
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white">
              {jobs.length}
            </Badge>
          </div>
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
              jobs.map(job => {
                const stageInstance = getStageInstanceForJob(job);
                return (
                  <EnhancedOperatorJobCard
                    key={job.job_id}
                    job={job}
                    onStart={onStart}
                    onComplete={onComplete}
                    onJobClick={onJobClick}
                    onRefresh={onRefresh}
                    currentStageInstance={stageInstance}
                  />
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
