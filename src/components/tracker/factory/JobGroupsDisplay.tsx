
import React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MasterQueueRenderer } from "./MasterQueueRenderer";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface JobGroup {
  title: string;
  jobs: AccessibleJob[];
  color: string;
}

interface JobGroupsDisplayProps {
  jobGroups: JobGroup[];
  viewMode: 'card' | 'list';
  searchQuery: string;
  onJobClick: (job: AccessibleJob) => void;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
}

export const JobGroupsDisplay: React.FC<JobGroupsDisplayProps> = ({
  jobGroups,
  viewMode,
  searchQuery,
  onJobClick,
  onStart,
  onComplete
}) => {
  if (jobGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-2">No jobs available</p>
          <p className="text-gray-400 text-sm">
            {searchQuery ? "Try adjusting your search or filters" : "Check back later for new jobs"}
          </p>
        </div>
      </div>
    );
  }

  if (viewMode === 'card') {
    return (
      <>
        {jobGroups.map(group => (
          <MasterQueueRenderer
            key={group.title}
            jobGroup={group}
            viewMode={viewMode}
            onJobClick={onJobClick}
            onStart={onStart}
            onComplete={onComplete}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {jobGroups.map(group => {
        console.log('🎨 Rendering list group:', group.title, 'Jobs:', group.jobs.length);
        return (
          <MasterQueueRenderer
            key={group.title}
            jobGroup={group}
            viewMode={viewMode}
            onJobClick={onJobClick}
            onStart={onStart}
            onComplete={onComplete}
          />
        );
      })}
    </>
  );
};
