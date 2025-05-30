
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, ArrowRight, AlertTriangle } from "lucide-react";

interface WorkflowPreviewProps {
  categoryName: string;
  stages: Array<{
    id: string;
    stage_order: number;
    estimated_duration_hours: number;
    is_required: boolean;
    production_stage: {
      id: string;
      name: string;
      color: string;
      description?: string;
    };
  }>;
}

export const WorkflowPreview = ({ categoryName, stages }: WorkflowPreviewProps) => {
  const totalDuration = stages.reduce((sum, stage) => sum + stage.estimated_duration_hours, 0);
  const totalDays = Math.ceil(totalDuration / 8); // Assuming 8-hour work days
  
  const getEstimatedCompletion = (stageIndex: number) => {
    const hoursUpToStage = stages.slice(0, stageIndex + 1).reduce((sum, stage) => sum + stage.estimated_duration_hours, 0);
    const daysUpToStage = Math.ceil(hoursUpToStage / 8);
    return daysUpToStage;
  };

  if (stages.length === 0) {
    return (
      <Card className="border-dashed border-2 border-gray-300">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertTriangle className="h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-600 mb-1">No Workflow Defined</h3>
          <p className="text-sm text-gray-500 text-center">
            Add production stages above to create a workflow for this category
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <CheckCircle className="h-5 w-5" />
          Workflow Preview: {categoryName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Workflow Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-lg border border-blue-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{stages.length}</div>
            <div className="text-sm text-blue-700">Total Stages</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{totalDuration}h</div>
            <div className="text-sm text-blue-700">Est. Duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{totalDays}</div>
            <div className="text-sm text-blue-700">Working Days</div>
          </div>
        </div>

        {/* Workflow Flow */}
        <div className="space-y-3">
          <h4 className="font-medium text-blue-900 mb-3">Production Flow</h4>
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-100">
                {/* Stage Number */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: stage.production_stage.color }}
                >
                  {stage.stage_order}
                </div>
                
                {/* Stage Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {stage.production_stage.name}
                    </span>
                    {stage.is_required && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        Required
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {stage.estimated_duration_hours}h
                    </div>
                    <div>Day {getEstimatedCompletion(index)}</div>
                  </div>
                </div>

                {/* Arrow */}
                {index < stages.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-blue-400" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Path */}
        <div className="p-4 bg-white rounded-lg border border-blue-200">
          <h5 className="font-medium text-blue-900 mb-2">Job Flow Path</h5>
          <p className="text-sm text-blue-800 leading-relaxed">
            Jobs in this category will flow through:{" "}
            <span className="font-medium">
              {stages.map(s => s.production_stage.name).join(' → ')}
            </span>
          </p>
          <p className="text-xs text-blue-700 mt-2">
            Estimated completion time: {totalDuration} hours ({totalDays} working days)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
