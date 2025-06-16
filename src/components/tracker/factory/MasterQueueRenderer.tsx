
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OperatorJobCard } from "./OperatorJobCard";
import { JobListView } from "../common/JobListView";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface JobGroup {
  title: string;
  jobs: AccessibleJob[];
  color: string;
}

interface MasterQueueRendererProps {
  jobGroup: JobGroup;
  viewMode: 'card' | 'list';
  onJobClick: (job: AccessibleJob) => void;
  onStart?: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete?: (jobId: string, stageId: string) => Promise<boolean>;
}

export const MasterQueueRenderer: React.FC<MasterQueueRendererProps> = ({
  jobGroup,
  viewMode,
  onJobClick,
  onStart,
  onComplete
}) => {
  if (viewMode === 'card') {
    return (
      <div className="flex flex-col min-h-0 w-80 lg:w-auto">
        {/* Column Header */}
        <div className={`${jobGroup.color} text-white px-4 py-3 rounded-t-lg flex-shrink-0`}>
          <h2 className="font-semibold">
            {jobGroup.title} ({jobGroup.jobs.length})
          </h2>
        </div>

        {/* Job Cards */}
        <div className="flex-1 border-l border-r border-b border-gray-200 rounded-b-lg overflow-hidden bg-white">
          <ScrollArea className="h-full max-h-96 lg:max-h-none">
            <div className="p-3 space-y-3">
              {jobGroup.jobs.map(job => (
                <OperatorJobCard
                  key={job.job_id}
                  job={job}
                  onClick={() => onJobClick(job)}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className={`${jobGroup.color} text-white px-4 py-3 rounded-t-lg`}>
        <h2 className="font-semibold">
          {jobGroup.title} ({jobGroup.jobs.length})
        </h2>
      </div>
      
      {/* Job List */}
      <JobListView
        jobs={jobGroup.jobs}
        onStart={onStart}
        onComplete={onComplete}
        onJobClick={onJobClick}
        className="rounded-t-none border-t-0"
      />
    </div>
  );
};
