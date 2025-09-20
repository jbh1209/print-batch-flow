
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle, AlertTriangle } from "lucide-react";
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

  // Calculate proof status breakdown for this column
  const statusBreakdown = useMemo(() => {
    const breakdown = {
      total: jobs.length,
      proofSent: 0,
      proofOverdue: 0,
      readyForProduction: 0,
      needsAttention: 0
    };

    jobs.forEach(job => {
      const isProofStage = job.current_stage_name?.toLowerCase().includes('proof') || 
                           stage.stage_name.toLowerCase().includes('proof');
      
      if (job.current_stage_status === 'completed' && isProofStage) {
        breakdown.readyForProduction++;
      } else if (job.proof_emailed_at) {
        breakdown.proofSent++;
        const elapsed = Date.now() - new Date(job.proof_emailed_at).getTime();
        const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
        
        if (days >= 3) {
          breakdown.proofOverdue++;
          breakdown.needsAttention++;
        } else if (days >= 1) {
          breakdown.needsAttention++;
        }
      }
    });

    return breakdown;
  }, [jobs, stage.stage_name]);

  return (
    <Card className="h-full flex flex-col max-h-[calc(100vh-12rem)]">
      <CardHeader 
        className="flex-shrink-0 text-white"
        style={{ backgroundColor: stage.stage_color }}
      >
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <span className="truncate">{stage.stage_name}</span>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {/* Proof Status Indicators */}
            {statusBreakdown.readyForProduction > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-green-500/90 text-white text-xs font-bold animate-pulse"
                title="Ready for Production"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                {statusBreakdown.readyForProduction}
              </Badge>
            )}
            {statusBreakdown.proofOverdue > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-red-500/90 text-white text-xs font-bold animate-pulse"
                title="Overdue Proofs"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {statusBreakdown.proofOverdue}
              </Badge>
            )}
            {statusBreakdown.proofSent > 0 && (
              <Badge 
                variant="secondary" 
                className="bg-blue-500/90 text-white text-xs font-bold"
                title="Proofs Sent"
              >
                <Mail className="h-3 w-3 mr-1" />
                {statusBreakdown.proofSent}
              </Badge>
            )}
            {/* Time and Total Count */}
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
