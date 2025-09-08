import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TouchOptimizedJobCard } from "./TouchOptimizedJobCard";
import { usePersonalOperatorQueue } from "@/hooks/tracker/usePersonalOperatorQueue";
import { useBarcodeControlledActions } from "@/hooks/tracker/useBarcodeControlledActions";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { 
  Clock, 
  Timer, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MyNextJobsViewProps {
  operatorId?: string;
  compactMode?: boolean;
}

export const MyNextJobsView: React.FC<MyNextJobsViewProps> = ({
  operatorId,
  compactMode = false
}) => {
  const { myNextJobs, activeJobs, isLoading, refetch } = usePersonalOperatorQueue(operatorId);
  const { startJobWithBarcode, completeJobWithBarcode, holdJobWithBarcode } = useBarcodeControlledActions();

  const allJobs = [...activeJobs, ...myNextJobs];
  const nextJob = myNextJobs[0];
  const hasActiveJobs = activeJobs.length > 0;

  const getTimeUntilStart = (scheduledStart?: string) => {
    if (!scheduledStart) return null;
    const start = new Date(scheduledStart);
    const now = new Date();
    const diffMinutes = Math.floor((start.getTime() - now.getTime()) / (1000 * 60));
    
    if (diffMinutes <= 0) return "Ready Now";
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-48">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading your queue...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compactMode) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="h-5 w-5" />
              My Queue ({allJobs.length})
            </CardTitle>
            <Button
              onClick={refetch}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {allJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p className="font-medium">No jobs in queue</p>
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            allJobs.map((job, index) => (
              <div key={job.job_stage_instance_id} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                  job.current_stage_status === 'active' ? "bg-blue-100 text-blue-800" :
                  index === 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                )}>
                  {job.current_stage_status === 'active' ? '▶' : index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{job.wo_no}</p>
                  {job.customer && (
                    <p className="text-sm text-gray-600 truncate">{job.customer}</p>
                  )}
                  <p className="text-xs text-gray-500">{job.current_stage_name}</p>
                </div>
                
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {formatTime(job.scheduled_start_at)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {getTimeUntilStart(job.scheduled_start_at)}
                  </p>
                  {job.is_rush && (
                    <Badge variant="destructive" className="text-xs mt-1">
                      RUSH
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Current Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasActiveJobs ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <div>
                  <p className="font-semibold text-blue-900">
                    Working on {activeJobs.length} job{activeJobs.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-blue-700">
                    {activeJobs.map(job => `${job.wo_no} (${job.current_stage_name})`).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Ready for next job</p>
                <p className="text-sm text-green-700">
                  {nextJob ? `Up next: ${nextJob.wo_no}` : 'No jobs in queue'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next 3 Jobs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              My Next 3 Jobs
            </CardTitle>
            <Button
              onClick={refetch}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {myNextJobs.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                All Caught Up!
              </h3>
              <p className="text-gray-500">
                No upcoming jobs in your queue. Check back later or contact your supervisor.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {myNextJobs.map((job, index) => (
                <div key={job.job_stage_instance_id} className="relative">
                  {/* Queue Position Badge */}
                  <div className="absolute -left-2 -top-2 z-10">
                    <Badge 
                      variant={index === 0 ? "default" : "secondary"}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold",
                        index === 0 ? "bg-green-600" : ""
                      )}
                    >
                      {index + 1}
                    </Badge>
                  </div>

                  {/* Job Card */}
                  <div className="ml-4">
                    <TouchOptimizedJobCard
                      job={{
                        job_id: job.job_id,
                        wo_no: job.wo_no,
                        customer: job.customer,
                        current_stage_id: job.job_stage_instance_id,
                        current_stage_name: job.current_stage_name,
                        current_stage_status: job.current_stage_status,
                        due_date: job.due_date,
                        workflow_progress: job.workflow_progress,
                        completed_stages: 0,
                        total_stages: 1,
                        reference: job.reference,
                        category_name: job.category_name,
                        category_color: job.category_color,
                        user_can_work: true,
                        id: job.job_stage_instance_id,
                        status: job.current_stage_status,
                        current_stage_color: '#3B82F6',
                        user_can_view: true,
                        locked: false,
                      } as AccessibleJob}
                      onStart={async (jobId, stageId) => {
                        return startJobWithBarcode({
                          type: 'start',
                          jobId,
                          stageId,
                          operatorId: operatorId || '',
                          woNo: job.wo_no,
                          stageName: job.current_stage_name,
                        });
                      }}
                      onComplete={async (jobId, stageId) => {
                        return completeJobWithBarcode({
                          type: 'complete',
                          jobId,
                          stageId,
                          operatorId: operatorId || '',
                          woNo: job.wo_no,
                          stageName: job.current_stage_name,
                        });
                      }}
                      onHold={async (jobId, reason) => {
                        return holdJobWithBarcode({
                          type: 'hold',
                          jobId,
                          stageId: job.job_stage_instance_id,
                          operatorId: operatorId || '',
                          woNo: job.wo_no,
                          stageName: job.current_stage_name,
                          reason,
                        });
                      }}
                      size="normal"
                      showFullDetails={true}
                    />

                    {/* Scheduling Info */}
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg border-l-4 border-gray-300">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">
                              Scheduled: {formatTime(job.scheduled_start_at)}
                            </span>
                          </div>
                          {job.estimated_duration_minutes && (
                            <div className="flex items-center gap-1">
                              <Timer className="h-4 w-4 text-gray-500" />
                              <span>{job.estimated_duration_minutes}min</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium",
                            index === 0 ? "text-green-600" : "text-gray-600"
                          )}>
                            {getTimeUntilStart(job.scheduled_start_at)}
                          </span>
                          {job.is_rush && (
                            <Badge variant="destructive" className="animate-pulse">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              RUSH
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};