
import React from "react";
import { MobileHeader } from "./mobile/MobileHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface MobileFactoryViewProps {
  workableStages: Array<{
    stage_id: string;
    stage_name: string;
    stage_color: string;
  }>;
  jobsByStage: Record<string, AccessibleJob[]>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onJobClick: (job: AccessibleJob) => void;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  isRefreshing: boolean;
}

export const MobileFactoryView: React.FC<MobileFactoryViewProps> = ({
  workableStages,
  jobsByStage,
  searchQuery,
  onSearchChange,
  onRefresh,
  onJobClick,
  onStart,
  onComplete,
  isRefreshing
}) => {
  const allJobs = Object.values(jobsByStage).flat();

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <MobileHeader
          title="Factory Floor"
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onRefresh={onRefresh}
          onQRScan={() => {}} // TODO: Implement QR scanning
          onBulkActions={() => {}} // TODO: Implement bulk actions
          selectedCount={0}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 pb-safe">
          {/* Stage Sections */}
          {workableStages.map(stage => {
            const stageJobs = jobsByStage[stage.stage_id] || [];
            
            if (stageJobs.length === 0) return null;
            
            return (
              <Card key={stage.stage_id} className="overflow-hidden">
                <CardHeader 
                  className="text-white py-3"
                  style={{ backgroundColor: stage.stage_color }}
                >
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{stage.stage_name}</span>
                    <Badge variant="secondary" className="bg-white/20 text-white ml-2 flex-shrink-0">
                      {stageJobs.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-0">
                  {stageJobs.map(job => (
                    <div 
                      key={job.job_id}
                      className="p-4 border-b last:border-b-0 border-l-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      style={{ borderLeftColor: stage.stage_color }}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div 
                            className="min-w-0 flex-1"
                            onClick={() => onJobClick(job)}
                          >
                            <h4 className="font-medium text-sm truncate">{job.wo_no}</h4>
                            <p className="text-xs text-gray-600 truncate">{job.customer}</p>
                            {job.reference && (
                              <p className="text-xs text-gray-500 truncate">Ref: {job.reference}</p>
                            )}
                          </div>
                          <Badge 
                            variant={job.current_stage_status === 'active' ? 'default' : 'outline'}
                            className={`flex-shrink-0 text-xs ${job.current_stage_status === 'active' ? 'bg-green-500' : ''}`}
                          >
                            {job.current_stage_status === 'pending' ? 'Ready' : 
                             job.current_stage_status === 'active' ? 'Active' : 
                             job.current_stage_status}
                          </Badge>
                        </div>

                        <JobActionButtons
                          job={job}
                          onStart={onStart}
                          onComplete={onComplete}
                          size="sm"
                          compact={true}
                          layout="horizontal"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {allJobs.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No jobs available for your stages.</p>
              <p className="text-sm text-gray-400 mt-2">Check back later or refresh to see updates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
