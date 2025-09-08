import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  AlertTriangle, 
  CheckCircle, 
  PlayCircle,
  X,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduledJobStage } from "@/hooks/tracker/useScheduledJobs";
import { JobSelection } from "@/hooks/tracker/useConcurrentJobManagement";

interface ConcurrentJobSelectorProps {
  availableJobs: ScheduledJobStage[];
  selectedJobs: JobSelection[];
  onToggleSelection: (job: ScheduledJobStage) => void;
  onClearSelection: () => void;
  onStartBatch: () => void;
  onRequestSupervisorOverride: (job: ScheduledJobStage) => void;
  isProcessing: boolean;
  batchCompatibility: {
    compatible: boolean;
    issues: string[];
  };
}

export const ConcurrentJobSelector: React.FC<ConcurrentJobSelectorProps> = ({
  availableJobs,
  selectedJobs,
  onToggleSelection,
  onClearSelection,
  onStartBatch,
  onRequestSupervisorOverride,
  isProcessing,
  batchCompatibility
}) => {
  const isSelected = (job: ScheduledJobStage) => 
    selectedJobs.some(selected => selected.stageId === job.id);

  const getSelectionStatus = (job: ScheduledJobStage) => {
    const selection = selectedJobs.find(s => s.stageId === job.id);
    if (!selection) return null;

    return {
      isCompatible: selection.isCompatible,
      conflicts: selection.conflictReasons
    };
  };

  const canStartBatch = selectedJobs.length > 0 && batchCompatibility.compatible;

  return (
    <div className="space-y-4">
      {/* Selection Header */}
      {selectedJobs.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Concurrent Job Selection ({selectedJobs.length})
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearSelection}
                className="text-gray-600"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {/* Selected Jobs List */}
              <div className="flex flex-wrap gap-2">
                {selectedJobs.map(job => (
                  <Badge 
                    key={job.stageId}
                    variant={job.isCompatible ? "default" : "destructive"}
                    className="flex items-center gap-1"
                  >
                    {job.isCompatible ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {job.woNo}
                  </Badge>
                ))}
              </div>

              {/* Compatibility Status */}
              {!batchCompatibility.compatible && (
                <div className="bg-red-50 border border-red-200 rounded p-3">
                  <div className="flex items-center gap-2 text-red-800 font-medium mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Batch Compatibility Issues
                  </div>
                  <ul className="text-sm text-red-700 space-y-1">
                    {batchCompatibility.issues.map((issue, index) => (
                      <li key={index}>• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Batch Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={onStartBatch}
                  disabled={!canStartBatch || isProcessing}
                  className={cn(
                    "flex-1",
                    canStartBatch ? "bg-green-600 hover:bg-green-700" : ""
                  )}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {isProcessing ? "Starting..." : `Start ${selectedJobs.length} Jobs`}
                </Button>
                
                {!batchCompatibility.compatible && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Open supervisor override modal
                      console.log('Request supervisor override for batch');
                    }}
                    className="flex items-center gap-1"
                  >
                    <Settings className="h-4 w-4" />
                    Override
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableJobs.map(job => {
          const selected = isSelected(job);
          const status = getSelectionStatus(job);
          
          return (
            <Card 
              key={job.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                selected && "ring-2 ring-blue-500 bg-blue-50",
                selected && !status?.isCompatible && "ring-red-500 bg-red-50",
                !job.is_ready_now && "opacity-60"
              )}
              onClick={() => onToggleSelection(job)}
            >
              <CardContent className="p-4">
                {/* Selection Checkbox */}
                <div className="flex items-start justify-between mb-3">
                  <Checkbox
                    checked={selected}
                    className="mt-1"
                  />
                  <div className="flex flex-col items-end gap-1">
                    <Badge 
                      variant={job.status === 'active' ? 'default' : 'outline'}
                      className={cn(
                        job.status === 'active' && "bg-green-600 text-white"
                      )}
                    >
                      {job.status === 'active' ? 'Active' : 'Ready'}
                    </Badge>
                    {job.queue_position && (
                      <Badge variant="outline" className="text-xs">
                        Queue #{job.queue_position}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Job Details */}
                <div className="space-y-2">
                  <div>
                    <h4 className="font-semibold text-sm">{job.wo_no}</h4>
                    <p className="text-xs text-gray-600">{job.customer}</p>
                  </div>
                  
                  <div className="text-xs" style={{ color: job.stage_color }}>
                    {job.stage_name}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Qty: {job.qty}</span>
                    {job.estimated_duration_minutes && (
                      <span>{Math.round(job.estimated_duration_minutes)} min</span>
                    )}
                  </div>
                </div>

                {/* Compatibility Status */}
                {status && !status.isCompatible && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs">
                    <div className="font-medium text-red-800 mb-1">Conflicts:</div>
                    {status.conflicts.map((conflict, index) => (
                      <div key={index} className="text-red-700">• {conflict}</div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 text-xs h-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestSupervisorOverride(job);
                      }}
                    >
                      Request Override
                    </Button>
                  </div>
                )}

                {/* Department Info */}
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <Badge variant="outline" className="text-xs">
                    {job.stage_name.includes('print') ? 'Printing' :
                     job.stage_name.includes('finish') ? 'Finishing' :
                     job.stage_name.includes('pack') ? 'Packaging' : 'Other'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {availableJobs.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Jobs Available</h3>
          <p className="text-gray-600">No jobs are currently ready for concurrent processing.</p>
        </div>
      )}
    </div>
  );
};