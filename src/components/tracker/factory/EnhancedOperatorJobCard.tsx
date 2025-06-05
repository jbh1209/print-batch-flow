
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Clock,
  Pause
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import { JobStatusDisplay } from "@/components/tracker/common/JobStatusDisplay";
import { JobNotesAndTimeTracker } from "@/components/tracker/common/JobNotesAndTimeTracker";
import { JobHoldManager } from "@/components/tracker/common/JobHoldManager";
import { 
  processJobStatus, 
  isJobOverdue, 
  isJobDueSoon
} from "@/hooks/tracker/useAccessibleJobs/jobStatusProcessor";

interface EnhancedOperatorJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onHold?: (jobId: string, reason: string, notes?: string) => Promise<boolean>;
  onRelease?: (jobId: string, notes?: string) => Promise<boolean>;
  onNotesUpdate?: (jobId: string, notes: string) => Promise<void>;
  onTimeUpdate?: (jobId: string, timeData: any) => Promise<void>;
}

export const EnhancedOperatorJobCard: React.FC<EnhancedOperatorJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onHold,
  onRelease,
  onNotesUpdate,
  onTimeUpdate
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'hold'>('notes');
  
  const isOverdue = isJobOverdue(job);
  const isDueSoon = isJobDueSoon(job);
  const jobStatus = processJobStatus(job);

  const getCardStyle = () => {
    if (jobStatus === 'active') return "border-blue-500 bg-blue-50 shadow-md";
    if (isOverdue) return "border-red-500 bg-red-50";
    if (isDueSoon) return "border-orange-500 bg-orange-50";
    return "border-gray-200 bg-white hover:shadow-sm";
  };

  return (
    <Card className={cn("mb-3 transition-all duration-200", getCardStyle())}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-gray-900 truncate mb-2">
                {job.wo_no}
              </h3>
              
              {job.customer && (
                <p className="text-sm text-gray-600 mb-2">
                  Customer: {job.customer}
                </p>
              )}
              
              {job.reference && (
                <p className="text-sm text-gray-600 mb-2">
                  Reference: {job.reference}
                </p>
              )}
            </div>

            {/* Expand/Collapse Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Status Display */}
          <JobStatusDisplay 
            job={job} 
            showDetails={true}
            compact={false}
          />

          {/* Progress Info */}
          {job.workflow_progress !== undefined && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Workflow Progress</span>
                <span className="font-bold">{job.workflow_progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${job.workflow_progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{job.completed_stages} completed</span>
                <span>{job.total_stages - job.completed_stages} remaining</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2">
            <JobActionButtons
              job={job}
              onStart={onStart}
              onComplete={onComplete}
              onHold={onHold}
              size="default"
              layout="horizontal"
              showHold={true}
              compact={false}
            />
          </div>

          {/* Active Timer Indicator */}
          {jobStatus === 'active' && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-100 px-3 py-2 rounded-lg">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="font-medium">Timer Active - You're working on this job</span>
            </div>
          )}

          {/* Expanded Content */}
          {isExpanded && (
            <div className="border-t pt-4 space-y-4">
              {/* Tab Navigation */}
              <div className="flex gap-2">
                <Button
                  variant={activeTab === 'notes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('notes')}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Notes & Time
                </Button>
                <Button
                  variant={activeTab === 'hold' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('hold')}
                  className="flex items-center gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Hold Management
                </Button>
              </div>

              {/* Tab Content */}
              {activeTab === 'notes' && (
                <JobNotesAndTimeTracker
                  job={job}
                  onNotesUpdate={onNotesUpdate}
                  onTimeUpdate={onTimeUpdate}
                />
              )}

              {activeTab === 'hold' && (
                <JobHoldManager
                  job={job}
                  onHoldJob={onHold}
                  onReleaseJob={onRelease}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
