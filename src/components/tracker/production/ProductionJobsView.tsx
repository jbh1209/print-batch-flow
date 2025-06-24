
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrafficLightIndicator } from "./TrafficLightIndicator";

interface ProductionJobsViewProps {
  jobs: any[];
  selectedStage?: string;
  isLoading: boolean;
  onJobClick?: (job: any) => void;
  onStageAction: (jobId: string, stageId: string, action: "start" | "complete" | "qr-scan") => void;
}

export const ProductionJobsView: React.FC<ProductionJobsViewProps> = ({
  jobs,
  selectedStage,
  isLoading,
  onJobClick,
  onStageAction
}) => {

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 border-green-200";
      case "active": return "bg-blue-100 text-blue-800 border-blue-200";
      case "pending": return "bg-gray-100 text-gray-600 border-gray-200";
      default: return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2" />
          <span>Loading jobs...</span>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <p className="text-gray-500 text-lg">No jobs found</p>
          <p className="text-gray-400">
            {selectedStage 
              ? `No jobs are currently active or pending in the ${selectedStage} stage` 
              : "Try adjusting your filters"
            }
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="flex items-center hover:bg-gray-50 transition-colors px-2 py-2 cursor-pointer"
          style={{ minHeight: 40 }}
          onClick={() => onJobClick?.(job)}
          data-testid={`job-row-${job.id}`}
        >
          {/* Due / traffic light */}
          <div className="flex items-center justify-center" style={{ width: 26 }}>
            <TrafficLightIndicator dueDate={job.due_date} />
          </div>
          
          {/* Job info */}
          <div className="flex-1 min-w-0 truncate ml-2">
            <span className="font-medium text-sm mr-2">{job.wo_no}</span>
            {job.category_name && (
              <Badge variant="outline" className="ml-0.5 mr-0.5">{job.category_name}</Badge>
            )}
            {job.customer && (
              <span className="text-xs text-gray-500 ml-1">{job.customer}</span>
            )}
            <span className="text-xs text-gray-400 ml-1">{job.reference}</span>
          </div>
          
          {/* Current Active Stage */}
          <div style={{ width: 120 }} className="truncate">
            {job.current_stage_name && (
              <Badge className={getStatusColor(job.stage_status)}>{job.current_stage_name}</Badge>
            )}
          </div>
          
          {/* Workflow Progress */}
          <div style={{ width: 80 }} className="pl-1">
            {typeof job.workflow_progress === "number" && (
              <Progress value={job.workflow_progress} className="h-1" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
