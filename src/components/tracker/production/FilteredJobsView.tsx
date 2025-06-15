
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronRight, ChevronDown } from "lucide-react";
import { TrafficLightIndicator } from "./TrafficLightIndicator";

interface FilteredJobsViewProps {
  jobs: any[];
  selectedStage?: string;
  isLoading: boolean;
  onStageAction: (jobId: string, stageId: string, action: "start" | "complete" | "qr-scan") => void;
}

export const FilteredJobsView: React.FC<FilteredJobsViewProps> = ({
  jobs,
  selectedStage,
  isLoading,
  onStageAction
}) => {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const handleJobClick = (jobId: string) => {
    setSelectedJobId(prev => prev === jobId ? null : jobId);
  };

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
          <p className="text-gray-400">Try adjusting your filters or stage selection</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {jobs.map((job) => (
        <div
          key={job.id}
          className={`flex items-center hover:bg-gray-50 transition-colors px-2 py-2 cursor-pointer ${selectedJobId === job.id ? 'bg-blue-50' : ''}`}
          style={{ minHeight: 40 }}
          onClick={() => handleJobClick(job.id)}
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
          
          {/* Stage/Status */}
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
          {/* Expand/Collapse Icon */}
          <div className="pl-2 pr-1 flex items-center" style={{ width: 30 }}>
            {selectedJobId === job.id
              ? <ChevronDown className="h-4 w-4 text-gray-400" />
              : <ChevronRight className="h-4 w-4 text-gray-400" />}
          </div>
        </div>
      ))}
    </div>
  );
};

