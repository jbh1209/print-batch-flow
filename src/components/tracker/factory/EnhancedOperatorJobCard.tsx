
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Play, 
  CheckCircle, 
  Calendar, 
  Hash, 
  Package,
  FileText,
  User,
  Building
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";

interface StageInstanceData {
  id: string;
  job_id: string;
  production_stage_id: string;
  status: string;
  part_name?: string;
  quantity?: number;
  notes?: string;
  stage_specifications?: {
    name: string;
    display_name: string;
  };
}

interface EnhancedOperatorJobCardProps {
  job: AccessibleJob;
  onStart: (jobId: string, stageId: string) => Promise<boolean>;
  onComplete: (jobId: string, stageId: string) => Promise<boolean>;
  onJobClick: (job: AccessibleJob) => void;
  onRefresh?: () => void;
  currentStageInstance?: StageInstanceData;
}

export const EnhancedOperatorJobCard: React.FC<EnhancedOperatorJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onJobClick,
  onRefresh,
  currentStageInstance
}) => {
  const isOverdue = job.due_date && new Date(job.due_date) < new Date();
  const canStart = job.user_can_work && job.current_stage_status === 'pending';
  const canComplete = job.user_can_work && job.current_stage_status === 'active';

  const handleStart = async () => {
    if (!job.current_stage_id) return;
    const success = await onStart(job.job_id, job.current_stage_id);
    if (success && onRefresh) {
      onRefresh();
    }
  };

  const handleComplete = async () => {
    if (!job.current_stage_id) return;
    const success = await onComplete(job.job_id, job.current_stage_id);
    if (success && onRefresh) {
      onRefresh();
    }
  };

  // Parse paper specifications
  const getPaperSpecs = () => {
    if (!currentStageInstance?.notes) return null;
    
    try {
      const parsed = JSON.parse(currentStageInstance.notes);
      return parsed;
    } catch {
      return currentStageInstance.notes;
    }
  };

  const paperSpecs = getPaperSpecs();

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isOverdue && "border-red-300 bg-red-50",
        job.current_stage_status === 'active' && "border-blue-300 bg-blue-50"
      )}
      onClick={() => onJobClick(job)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
              className={cn(
                job.current_stage_status === 'active' && "bg-blue-600"
              )}
            >
              {job.wo_no}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                Overdue
              </Badge>
            )}
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Building className="h-3 w-3" />
            <span className="truncate">{job.customer || 'Unknown Customer'}</span>
          </div>
          
          {job.due_date && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Calendar className="h-3 w-3" />
              <span>{new Date(job.due_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stage Specifications */}
        {(currentStageInstance?.stage_specifications || currentStageInstance?.part_name || currentStageInstance?.quantity) && (
          <>
            <div className="space-y-2">
              {currentStageInstance.stage_specifications && (
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    {currentStageInstance.stage_specifications.display_name}
                  </span>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2">
                {currentStageInstance.part_name && (
                  <div className="flex items-center gap-1">
                    <Package className="h-3 w-3 text-green-600" />
                    <Badge variant="outline" className="text-xs border-green-600 text-green-700">
                      {currentStageInstance.part_name}
                    </Badge>
                  </div>
                )}
                
                {currentStageInstance.quantity && (
                  <div className="flex items-center gap-1">
                    <Hash className="h-3 w-3 text-orange-600" />
                    <Badge variant="outline" className="text-xs border-orange-600 text-orange-700">
                      {currentStageInstance.quantity.toLocaleString()}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            
            {paperSpecs && (
              <div className="text-xs bg-gray-100 p-2 rounded">
                <div className="font-medium text-gray-700 mb-1">Paper Specs:</div>
                {typeof paperSpecs === 'string' ? (
                  <div className="text-gray-600">{paperSpecs}</div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(paperSpecs).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-gray-700 font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <Separator />
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {canStart && (
            <Button 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                handleStart();
              }}
              className="flex-1"
            >
              <Play className="h-3 w-3 mr-1" />
              Start
            </Button>
          )}
          
          {canComplete && (
            <Button 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                handleComplete();
              }}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Button>
          )}
          
          {!canStart && !canComplete && (
            <div className="text-xs text-gray-500 text-center flex-1 py-2">
              {job.current_stage_status === 'completed' ? 'Completed' : 'Waiting'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
