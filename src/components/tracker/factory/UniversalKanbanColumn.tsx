
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
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
}

export const UniversalKanbanColumn: React.FC<UniversalKanbanColumnProps> = ({
  stage,
  jobs,
  onStart,
  onComplete,
  onJobClick
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
                <Card 
                  key={job.job_id}
                  className="cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 hover:scale-[1.02]"
                  style={{ borderLeftColor: stage.stage_color }}
                  onClick={() => onJobClick(job)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="space-y-3">
                      {/* Job Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm sm:text-lg truncate">{job.wo_no}</h4>
                          <p className="text-xs sm:text-sm text-gray-600 truncate">{job.customer}</p>
                        </div>
                        <Badge 
                          variant={job.current_stage_status === 'active' ? 'default' : 'outline'}
                          className={`flex-shrink-0 text-xs ${job.current_stage_status === 'active' ? 'bg-green-500' : ''}`}
                        >
                          {job.current_stage_status === 'pending' ? 'Ready to Start' : 
                           job.current_stage_status === 'active' ? 'In Progress' : 
                           job.current_stage_status}
                        </Badge>
                      </div>

                      {/* Job Details */}
                      <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                        {job.reference && (
                          <p className="truncate">
                            <span className="font-medium">Ref:</span> {job.reference}
                          </p>
                        )}
                        {job.due_date && (
                          <p>
                            <span className="font-medium">Due:</span> {new Date(job.due_date).toLocaleDateString()}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Progress:</span> {job.workflow_progress}%
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t border-gray-100">
                        <JobActionButtons
                          job={job}
                          onStart={onStart}
                          onComplete={onComplete}
                          size="sm"
                          compact={true}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
