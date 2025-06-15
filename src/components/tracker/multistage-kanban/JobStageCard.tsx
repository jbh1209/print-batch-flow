
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode, Play, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import StageTimer from "./StageTimer";

const JobStageCard: React.FC<{
  jobStage: any;
  onStageAction: (stageId: string, action: "start" | "complete" | "scan") => void;
}> = ({ jobStage, onStageAction }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "active":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "pending":
        return "bg-gray-100 text-gray-600 border-gray-200";
      case "skipped":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "active":
        return <Play className="h-4 w-4 text-blue-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-gray-400" />;
      case "skipped":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <Card className={`mb-3 transition-all duration-200 ${
      jobStage.status === 'active' ? 'ring-2 ring-blue-300 shadow-lg' : 'hover:shadow-md'
    }`}>
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-sm">{jobStage.production_job?.wo_no}</h4>
              {jobStage.production_job?.customer && (
                <p className="text-xs text-gray-600">{jobStage.production_job.customer}</p>
              )}
            </div>
            <Badge variant="outline" className={getStatusColor(jobStage.status)}>
              <div className="flex items-center gap-1">
                {getStatusIcon(jobStage.status)}
                {jobStage.status}
              </div>
            </Badge>
          </div>
          <div className="text-xs text-gray-500">
            Stage {jobStage.stage_order} • {jobStage.production_stage.name}
          </div>
          {jobStage.status === "active" && (
            <StageTimer startedAt={jobStage.started_at} />
          )}
          {jobStage.production_job?.due_date && (
            <div className="text-xs text-gray-500">
              Due: {new Date(jobStage.production_job.due_date).toLocaleDateString()}
            </div>
          )}
          <div className="flex gap-1">
            {jobStage.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStageAction(jobStage.id, "scan")}
                  className="text-xs h-7"
                >
                  <QrCode className="h-3 w-3 mr-1" />
                  Scan
                </Button>
                <Button
                  size="sm"
                  onClick={() => onStageAction(jobStage.id, "start")}
                  className="text-xs h-7"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </Button>
              </>
            )}
            {jobStage.status === "active" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStageAction(jobStage.id, "scan")}
                  className="text-xs h-7"
                >
                  <QrCode className="h-3 w-3 mr-1" />
                  Scan
                </Button>
                <Button
                  size="sm"
                  onClick={() => onStageAction(jobStage.id, "complete")}
                  className="text-xs h-7 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </Button>
              </>
            )}
          </div>
          {jobStage.notes && (
            <div className="text-xs p-2 bg-gray-50 rounded">
              <strong>Notes:</strong> {jobStage.notes}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default JobStageCard;
