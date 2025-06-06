
import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Play, 
  CheckCircle, 
  FileText, 
  User, 
  Calendar,
  Mail,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AccessibleJob } from "@/hooks/tracker/useAccessibleJobs";
import { JobStatusDisplay } from "@/components/tracker/common/JobStatusDisplay";
import { JobActionButtons } from "@/components/tracker/common/JobActionButtons";
import ProofUploadDialog from "./ProofUploadDialog";
import { ProofStatusIndicator } from "./ProofStatusIndicator";

interface EnhancedOperatorJobCardProps {
  job: AccessibleJob;
  onStart?: (jobId: string, jobTableName: string, stageId?: string) => Promise<boolean>;
  onComplete?: (jobId: string, jobTableName: string, stageId?: string) => Promise<boolean>;
  onRefresh?: () => void;
  currentStageInstance?: any;
}

export const EnhancedOperatorJobCard: React.FC<EnhancedOperatorJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onRefresh,
  currentStageInstance
}) => {
  const [showProofDialog, setShowProofDialog] = useState(false);
  
  const isProofStage = currentStageInstance?.production_stage?.name?.toLowerCase().includes('proof');
  const canSendProof = isProofStage && currentStageInstance?.status === 'active';

  const handleProofSent = () => {
    setShowProofDialog(false);
    onRefresh?.();
  };

  return (
    <>
      <Card className={cn(
        "transition-all duration-200 hover:shadow-md",
        job.current_stage_status === 'active' && "ring-2 ring-blue-500 ring-opacity-50"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{job.wo_no}</h3>
                <Badge 
                  variant={job.current_stage_status === 'active' ? 'default' : 'secondary'}
                  className={cn(
                    job.current_stage_status === 'active' && "bg-green-500"
                  )}
                >
                  {job.current_stage_name}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{job.customer}</span>
                </div>
                {job.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(job.due_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            <JobStatusDisplay job={job} compact />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Proof Status Indicator */}
          {isProofStage && currentStageInstance && (
            <ProofStatusIndicator stageInstance={currentStageInstance} />
          )}

          {/* Progress Indicator */}
          {job.workflow_progress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{job.workflow_progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${job.workflow_progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <JobActionButtons
              job={job}
              onStart={onStart}
              onComplete={onComplete}
            />
            
            {canSendProof && (
              <Button
                onClick={() => setShowProofDialog(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Send Proof
              </Button>
            )}
          </div>

          {/* Additional Job Info */}
          <div className="pt-2 border-t">
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
              <div>
                <span className="font-medium">Category:</span>
                <span className="ml-1">{job.category_name || 'None'}</span>
              </div>
              <div>
                <span className="font-medium">Status:</span>
                <span className="ml-1">{job.status}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proof Upload Dialog */}
      <ProofUploadDialog
        isOpen={showProofDialog}
        onClose={() => setShowProofDialog(false)}
        stageInstanceId={currentStageInstance?.id || ''}
        onProofSent={handleProofSent}
      />
    </>
  );
};
