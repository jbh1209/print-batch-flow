
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompactDtpJobCard } from "./CompactDtpJobCard";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface DtpKanbanColumnProps {
  title: string;
  jobs: AccessibleJob[];
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  colorClass?: string;
  icon?: React.ReactNode;
}

export const DtpKanbanColumn: React.FC<DtpKanbanColumnProps> = ({
  title,
  jobs,
  onStart,
  onComplete,
  colorClass = "bg-blue-600",
  icon
}) => {
  return (
    <div className="flex-1 min-w-0">
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {icon}
              <span>{title}</span>
            </div>
            <Badge className={colorClass}>
              {jobs.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-0 max-h-[calc(100vh-280px)] overflow-y-auto">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                <p>No jobs in {title.toLowerCase()}</p>
              </div>
            ) : (
              jobs.map((job) => (
                <CompactDtpJobCard
                  key={job.job_id}
                  job={job}
                  onStart={onStart}
                  onComplete={onComplete}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
