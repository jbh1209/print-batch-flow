
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  CheckCircle, 
  Clock, 
  QrCode, 
  AlertCircle,
  ArrowRight 
} from "lucide-react";

interface JobStageProgressProps {
  jobStages: Array<{
    id: string;
    stage_order: number;
    status: 'pending' | 'active' | 'completed' | 'skipped';
    started_at?: string;
    completed_at?: string;
    notes?: string;
    production_stage: {
      id: string;
      name: string;
      color: string;
      description?: string;
    };
  }>;
  currentStage?: {
    id: string;
    stage_order: number;
    status: string;
    production_stage: {
      id: string;
      name: string;
      color: string;
    };
  } | null;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  onStartStage: (stageId: string) => void;
  onCompleteStage: (stageId: string, notes?: string) => void;
  onQRScan: (stageId: string) => void;
  isProcessing: boolean;
}

export const JobStageProgress = ({
  jobStages,
  currentStage,
  progress,
  onStartStage,
  onCompleteStage,
  onQRScan,
  isProcessing
}: JobStageProgressProps) => {
  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'active':
        return <Play className="h-4 w-4 text-blue-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  if (jobStages.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-600 mb-1">No Workflow Defined</h3>
          <p className="text-sm text-gray-500 text-center">
            This job needs to be assigned to a category with a defined workflow
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Production Workflow</span>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {progress.completed}/{progress.total} stages
          </Badge>
        </CardTitle>
        <div className="space-y-2">
          <Progress value={progress.percentage} className="w-full" />
          <p className="text-sm text-gray-600">
            {progress.percentage}% complete
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobStages.map((stage, index) => (
          <div
            key={stage.id}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
              stage.status === 'active' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            {/* Stage Indicator */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm"
                style={{ backgroundColor: stage.production_stage.color }}
              >
                {stage.stage_order}
              </div>
              {index < jobStages.length - 1 && (
                <ArrowRight className="h-4 w-4 text-gray-300 mt-1" />
              )}
            </div>
            
            {/* Stage Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {getStageIcon(stage.status)}
                <h4 className="font-medium text-gray-900 truncate">
                  {stage.production_stage.name}
                </h4>
                <Badge variant="outline" className={getStatusColor(stage.status)}>
                  {stage.status}
                </Badge>
              </div>
              
              {stage.production_stage.description && (
                <p className="text-sm text-gray-600 mb-2">
                  {stage.production_stage.description}
                </p>
              )}
              
              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {stage.started_at && (
                  <span>Started: {new Date(stage.started_at).toLocaleString()}</span>
                )}
                {stage.completed_at && (
                  <span>Completed: {new Date(stage.completed_at).toLocaleString()}</span>
                )}
              </div>
              
              {/* Notes */}
              {stage.notes && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                  <strong>Notes:</strong> {stage.notes}
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="flex-shrink-0 flex gap-2">
              {stage.status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQRScan(stage.id)}
                    disabled={isProcessing}
                    className="flex items-center gap-1"
                  >
                    <QrCode className="h-3 w-3" />
                    Scan
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onStartStage(stage.id)}
                    disabled={isProcessing}
                  >
                    Start
                  </Button>
                </>
              )}
              
              {stage.status === 'active' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onQRScan(stage.id)}
                    disabled={isProcessing}
                    className="flex items-center gap-1"
                  >
                    <QrCode className="h-3 w-3" />
                    Scan
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onCompleteStage(stage.id)}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Complete
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
