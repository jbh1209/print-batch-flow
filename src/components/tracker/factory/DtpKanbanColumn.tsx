
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, CheckCircle, AlertTriangle } from "lucide-react";
import { JobErrorBoundary } from "../error-boundaries/JobErrorBoundary";
import { CompactDtpJobCard } from "./CompactDtpJobCard";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { cn } from "@/lib/utils";

interface DtpKanbanColumnProps {
  title: string;
  jobs: AccessibleJob[];
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onJobClick: (job: AccessibleJob) => void;
  colorClass: string;
  icon: React.ReactNode;
}

export const DtpKanbanColumn: React.FC<DtpKanbanColumnProps> = ({
  title,
  jobs,
  onStart,
  onComplete,
  onJobClick,
  colorClass,
  icon
}) => {
  // Calculate proof status breakdown
  const statusBreakdown = useMemo(() => {
    const breakdown = {
      total: jobs.length,
      proofSent: 0,
      proofOverdue: 0,
      readyForProduction: 0,
      needsAttention: 0
    };

    jobs.forEach(job => {
      const isProofStage = job.current_stage_name?.toLowerCase().includes('proof');
      
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
  }, [jobs]);

  return (
    <Card className="flex-1 flex flex-col h-full">
      <CardHeader className={`${colorClass} text-white py-3`}>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
          <div className="ml-auto flex items-center gap-2">
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
            {/* Total Count */}
            <span className="bg-white/20 px-2 py-1 rounded text-sm">
              {jobs.length}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 p-4 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p className="text-sm">No jobs available</p>
              </div>
            ) : (
              jobs.map((job) => (
                <JobErrorBoundary 
                  key={job.job_id} 
                  jobId={job.job_id} 
                  jobWoNo={job.wo_no}
                >
                  <CompactDtpJobCard
                    job={job}
                    onStart={onStart}
                    onComplete={onComplete}
                    onJobClick={onJobClick}
                    showActions={true}
                  />
                </JobErrorBoundary>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
