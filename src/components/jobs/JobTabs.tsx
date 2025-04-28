
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExtendedJob } from '@/hooks/useAllPendingJobs';

interface JobTabsProps {
  allJobs: ExtendedJob[];
  criticalJobs: ExtendedJob[];
  highJobs: ExtendedJob[];
  mediumJobs: ExtendedJob[];
  lowJobs: ExtendedJob[];
}

const JobTabs: React.FC<JobTabsProps> = ({
  allJobs,
  criticalJobs,
  highJobs,
  mediumJobs,
  lowJobs
}) => {
  return (
    <div className="px-4 pt-2">
      <TabsList className="grid grid-cols-5 mb-4">
        <TabsTrigger value="all">
          All Jobs ({allJobs.length})
        </TabsTrigger>
        <TabsTrigger value="critical" className="text-red-600">
          Critical ({criticalJobs.length})
        </TabsTrigger>
        <TabsTrigger value="high" className="text-amber-600">
          High ({highJobs.length})
        </TabsTrigger>
        <TabsTrigger value="medium" className="text-yellow-600">
          Medium ({mediumJobs.length})
        </TabsTrigger>
        <TabsTrigger value="low" className="text-emerald-600">
          Low ({lowJobs.length})
        </TabsTrigger>
      </TabsList>
    </div>
  );
};

export default JobTabs;
