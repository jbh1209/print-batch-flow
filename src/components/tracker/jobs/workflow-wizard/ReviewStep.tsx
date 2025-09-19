import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, Calendar, Clock, Target, ArrowRight, RefreshCw } from "lucide-react";

interface StageConfig {
  id: string;
  name: string;
  color: string;
  order: number;
  quantity?: number | null;
  estimatedDurationMinutes?: number | null;
  partAssignment?: 'cover' | 'text' | 'both' | null;
  stageSpecificationId?: string | null;
}

interface ScheduleImpact {
  hasScheduledSlots: boolean;
  affectedStages: number;
}

interface ReviewStepProps {
  stages: StageConfig[];
  jobData: {
    wo_no: string;
    qty: number;
    customer?: string;
    category?: string;
  };
  scheduleImpact?: ScheduleImpact | null;
  manualDueDate: string;
  manualSlaDays: number;
  onRescheduleJob: () => void;
  onInvalidateSchedule: () => void;
  isRescheduling?: boolean;
  isInvalidating?: boolean;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  stages,
  jobData,
  scheduleImpact,
  manualDueDate,
  manualSlaDays,
  onRescheduleJob,
  onInvalidateSchedule,
  isRescheduling = false,
  isInvalidating = false
}) => {
  const getValidationIssues = () => {
    const issues: string[] = [];
    
    const stagesWithoutQuantity = stages.filter(s => !s.quantity);
    const stagesWithoutDuration = stages.filter(s => !s.estimatedDurationMinutes);
    
    if (stagesWithoutQuantity.length > 0) {
      issues.push(`${stagesWithoutQuantity.length} stages missing quantity`);
    }
    
    if (stagesWithoutDuration.length > 0) {
      issues.push(`${stagesWithoutDuration.length} stages missing duration estimates`);
    }
    
    if (!manualDueDate && manualSlaDays <= 0) {
      issues.push('No due date or SLA days specified');
    }
    
    return issues;
  };

  const calculateTotals = () => {
    const totalQuantity = stages.reduce((sum, stage) => sum + (stage.quantity || 0), 0);
    const totalDuration = stages.reduce((sum, stage) => sum + (stage.estimatedDurationMinutes || 0), 0);
    const estimatedDays = Math.ceil(totalDuration / (8 * 60)); // Assuming 8-hour work days
    
    return { totalQuantity, totalDuration, estimatedDays };
  };

  const { totalQuantity, totalDuration, estimatedDays } = calculateTotals();
  const validationIssues = getValidationIssues();
  const hasIssues = validationIssues.length > 0;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const calculateDueDate = () => {
    if (manualDueDate) {
      return new Date(manualDueDate).toLocaleDateString();
    }
    if (manualSlaDays > 0) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + manualSlaDays);
      return dueDate.toLocaleDateString();
    }
    return 'Not specified';
  };

  return (
    <div className="space-y-6">
      {/* Job Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Job Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Work Order:</span>
              <p className="font-semibold">{jobData.wo_no}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Quantity:</span>
              <p className="font-semibold">{jobData.qty}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Customer:</span>
              <p className="font-semibold">{jobData.customer || 'Not specified'}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Category:</span>
              <p className="font-semibold">{jobData.category || 'Custom Workflow'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <ArrowRight className="h-4 w-4" />
            <span>Workflow Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Total Stages:</span>
              <p className="font-semibold">{stages.length}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Total Quantity:</span>
              <p className="font-semibold">{totalQuantity}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Estimated Duration:</span>
              <p className="font-semibold">{formatDuration(totalDuration)}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Estimated Days:</span>
              <p className="font-semibold">{estimatedDays} working days</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Stage Sequence:</h4>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex items-center space-x-1">
                  <Badge 
                    variant="outline" 
                    style={{ 
                      backgroundColor: `${stage.color}20`, 
                      color: stage.color, 
                      borderColor: `${stage.color}40` 
                    }}
                    className="text-xs"
                  >
                    {index + 1}. {stage.name}
                  </Badge>
                  {index < stages.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Due Date & Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Timeline & Due Date</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Due Date:</span>
              <p className="font-semibold">{calculateDueDate()}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">SLA Days:</span>
              <p className="font-semibold">{manualSlaDays > 0 ? `${manualSlaDays} days` : 'Not set'}</p>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Buffer Time:</span>
              <p className="font-semibold text-green-600">
                {manualSlaDays > estimatedDays ? `+${manualSlaDays - estimatedDays} days` : 'Tight schedule'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Impact */}
      {scheduleImpact && scheduleImpact.hasScheduledSlots && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center space-x-2 text-amber-800">
              <Clock className="h-4 w-4" />
              <span>Schedule Impact</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-amber-700">
                This job currently has <strong>{scheduleImpact.affectedStages} scheduled stages</strong>. 
                Applying this workflow will invalidate the existing schedule.
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onInvalidateSchedule}
                  disabled={isInvalidating}
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                >
                  {isInvalidating ? 'Clearing...' : 'Clear Schedule'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRescheduleJob}
                  disabled={isRescheduling}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100 flex items-center space-x-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>{isRescheduling ? 'Rescheduling...' : 'Reschedule After Apply'}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Issues */}
      {hasIssues && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center space-x-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span>Configuration Issues</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-red-700">
              {validationIssues.map((issue, index) => (
                <li key={index} className="flex items-center space-x-2">
                  <span>•</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-red-600 mt-2">
              These issues won't prevent workflow creation, but may affect scheduling accuracy.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Success Summary */}
      {!hasIssues && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-base flex items-center space-x-2 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <span>Ready to Apply</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-700">
              Your custom workflow is fully configured and ready to be applied. 
              All stages have proper quantities and duration estimates.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};