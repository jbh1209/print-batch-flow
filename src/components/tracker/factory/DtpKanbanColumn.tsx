
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { JobErrorBoundary } from "../error-boundaries/JobErrorBoundary";
import { CompactDtpJobCard } from "./CompactDtpJobCard";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

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
  return (
    <Card className="flex-1 flex flex-col h-full">
      <CardHeader className={`${colorClass} text-white py-3`}>
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
          <span className="ml-auto bg-white/20 px-2 py-1 rounded text-sm">
            {jobs.length}
          </span>
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
