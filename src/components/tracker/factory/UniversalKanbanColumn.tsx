
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
    <div className="flex flex-col h-full">
      <Card className="h-full flex flex-col">
        <CardHeader 
          className="flex-shrink-0 text-white"
          style={{ backgroundColor: stage.stage_color }}
        >
          <CardTitle className="flex items-center justify-between text-lg">
            <span>{stage.stage_name}</span>
            <Badge variant="secondary" className="bg-white/20 text-white">
              {jobs.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {jobs.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No jobs in this stage
            </div>
          ) : (
            jobs.map(job => (
              <Card 
                key={job.job_id}
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                style={{ borderLeftColor: stage.stage_color }}
                onClick={() => onJobClick(job)}
              >
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Job Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-lg">{job.wo_no}</h4>
                        <p className="text-sm text-gray-600">{job.customer}</p>
                      </div>
                      <Badge 
                        variant={job.current_stage_status === 'active' ? 'default' : 'outline'}
                        className={job.current_stage_status === 'active' ? 'bg-green-500' : ''}
                      >
                        {job.current_stage_status === 'pending' ? 'Ready to Start' : 
                         job.current_stage_status === 'active' ? 'In Progress' : 
                         job.current_stage_status}
                      </Badge>
                    </div>

                    {/* Job Details */}
                    <div className="text-sm text-gray-600 space-y-1">
                      {job.reference && <p>Ref: {job.reference}</p>}
                      {job.due_date && (
                        <p>Due: {new Date(job.due_date).toLocaleDateString()}</p>
                      )}
                      <p>Progress: {job.workflow_progress}%</p>
                    </div>

                    {/* Actions */}
                    <JobActionButtons
                      job={job}
                      onStart={onStart}
                      onComplete={onComplete}
                      size="sm"
                      compact={true}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
