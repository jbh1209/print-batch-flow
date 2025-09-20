
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Play,
  Mail,
  PrinterIcon,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { ProofStatusIndicator } from "./ProofStatusIndicator";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface StatusBadgeInfo {
  text: string;
  className: string;
  variant: "default" | "destructive" | "secondary" | "outline";
}

interface CurrentStageCardProps {
  job: AccessibleJob;
  statusInfo: StatusBadgeInfo;
}

interface StageInstanceData {
  estimated_duration_minutes: number | null;
  started_at: string | null;
  part_name: string | null;
  quantity: number | null;
  notes: string | null;
  stage_specification_id: string | null;
  production_stage?: {
    name: string;
  };
  stage_specifications?: {
    name: string;
    display_name: string;
  };
}

export const CurrentStageCard: React.FC<CurrentStageCardProps> = ({ 
  job, 
  statusInfo 
}) => {
  const [currentStageInfo, setCurrentStageInfo] = useState<{
    estimatedDuration: number | null;
    estimatedCompletion: string | null;
    stageInstance: StageInstanceData | null;
  }>({ 
    estimatedDuration: null, 
    estimatedCompletion: null,
    stageInstance: null
  });

  // Fetch current stage timing and specification information
  useEffect(() => {
    if (!job.current_stage_id) return;

    const fetchStageInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('job_stage_instances')
          .select(`
            estimated_duration_minutes, 
            started_at,
            part_name,
            quantity,
            notes,
            stage_specification_id,
            production_stage:production_stages(name)
          `)
          .eq('job_id', job.job_id)
          .eq('production_stage_id', job.current_stage_id)
          .eq('status', 'active')
          .maybeSingle();

        if (data && !error) {
          const estimatedDuration = data.estimated_duration_minutes;
          let estimatedCompletion = null;
          
          if (data.started_at && estimatedDuration) {
            const startTime = new Date(data.started_at);
            const completionTime = new Date(startTime.getTime() + estimatedDuration * 60000);
            estimatedCompletion = completionTime.toLocaleString();
          }

          setCurrentStageInfo({
            estimatedDuration,
            estimatedCompletion,
            stageInstance: {
              estimated_duration_minutes: data.estimated_duration_minutes,
              started_at: data.started_at,
              part_name: data.part_name,
              quantity: data.quantity,
              notes: data.notes,
              stage_specification_id: data.stage_specification_id,
              production_stage: data.production_stage
            }
          });
        }
      } catch (error) {
        console.error('Error fetching stage info:', error);
      }
    };

    fetchStageInfo();
  }, [job.current_stage_id, job.job_id, job.current_stage_status]);

  // Format duration as hours and minutes
  const formatDuration = (minutes: number | null): string => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  // Get appropriate icon based on status
  const getStatusIcon = (text: string) => {
    if (text.includes('Progress')) return <Clock className="h-4 w-4" />;
    if (text.includes('Completed')) return <CheckCircle className="h-4 w-4" />;
    if (text.includes('Overdue')) return <AlertTriangle className="h-4 w-4" />;
    return <Play className="h-4 w-4" />;
  };

  // Get sub-specification name
  const getSubSpecification = () => {
    if (currentStageInfo.stageInstance?.stage_specifications?.display_name) {
      return currentStageInfo.stageInstance.stage_specifications.display_name;
    }
    return null;
  };

  // Check for proof-related stage and create proof stage instance
  const isProofStage = job.current_stage_name?.toLowerCase().includes('proof');
  const hasProofData = job.proof_emailed_at || isProofStage;
  
  const proofStageInstance = hasProofData ? {
    status: job.current_stage_status,
    proof_emailed_at: job.proof_emailed_at,
    client_email: job.contact,
    client_name: job.customer,
    updated_at: undefined
  } : null;

  return (
    <div className="space-y-4">
      <Card className={cn(
        "transition-all duration-200",
        proofStageInstance && job.current_stage_status === 'completed' && "factory-success border-green-500",
        proofStageInstance && job.proof_emailed_at && job.current_stage_status !== 'completed' && "factory-info border-blue-500"
      )}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Current Stage
            </div>
            {/* Enhanced Proof Status in Header */}
            {proofStageInstance && (
              <div className="ml-4">
                <ProofStatusIndicator 
                  stageInstance={proofStageInstance}
                  variant="default"
                  showTimeElapsed={true}
                />
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: job.current_stage_color || '#6B7280' }}
              />
              <div>
                <h3 className="font-semibold text-lg">
                  {job.current_stage_name || 'No Stage Assigned'}
                </h3>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Stage {job.completed_stages + 1} of {job.total_stages}
                  </p>
                  {currentStageInfo.estimatedDuration && (
                    <p className="text-xs text-blue-600 font-medium">
                      Est. {formatDuration(currentStageInfo.estimatedDuration)}
                    </p>
                  )}
                  {currentStageInfo.estimatedCompletion && (
                    <p className="text-xs text-gray-500">
                      Expected: {currentStageInfo.estimatedCompletion}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <Badge 
              className={cn(statusInfo.className)}
              variant={statusInfo.variant}
            >
              {getStatusIcon(statusInfo.text)}
              <span className="ml-1">{statusInfo.text}</span>
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Workflow Progress</span>
              <span className="text-sm font-bold text-gray-900">{job.workflow_progress}%</span>
            </div>
            <Progress value={job.workflow_progress} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">{job.completed_stages}</div>
              <div className="text-xs text-gray-600">Completed</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold text-blue-600">
                {job.total_stages - job.completed_stages}
              </div>
              <div className="text-xs text-gray-600">Remaining</div>
            </div>
          </div>

          {/* Due Date Display */}
          {job.due_date && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Due Date</span>
                <span className="text-sm font-bold text-gray-900">
                  {new Date(job.due_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          {/* Permissions Display */}
          <div className="pt-3 border-t">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Your Permissions</h4>
            <div className="flex flex-wrap gap-2">
              {job.user_can_view && (
                <Badge variant="secondary" className="text-xs">View</Badge>
              )}
              {job.user_can_edit && (
                <Badge variant="secondary" className="text-xs">Edit</Badge>
              )}
              {job.user_can_work && (
                <Badge variant="default" className="text-xs bg-green-600">Work</Badge>
              )}
              {job.user_can_manage && (
                <Badge variant="default" className="text-xs bg-blue-600">Manage</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
