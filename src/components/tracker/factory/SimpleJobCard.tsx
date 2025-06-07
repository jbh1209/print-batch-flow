
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Mail } from "lucide-react";
import { SimpleFactoryJob } from "@/hooks/tracker/useSimpleFactoryJobs";
import { ProofStatusIndicator } from "./ProofStatusIndicator";

interface SimpleJobCardProps {
  job: SimpleFactoryJob;
  onStart: (stageInstanceId: string) => void;
  onComplete: (stageInstanceId: string) => void;
  onSendProof: (stageInstanceId: string) => void;
  isProcessing: boolean;
}

export const SimpleJobCard: React.FC<SimpleJobCardProps> = ({
  job,
  onStart,
  onComplete,
  onSendProof,
  isProcessing
}) => {
  const isProofStage = job.stage_name.toLowerCase().includes('proof');
  
  const canStartStage = job.stage_status === 'pending';
  const canCompleteStage = job.stage_status === 'active' || job.stage_status === 'client_approved';
  const canSendProof = isProofStage && job.stage_status === 'active';

  return (
    <Card className={`
      ${job.stage_status === 'active' ? 'ring-2 ring-blue-500 ring-opacity-50' :
        job.stage_status === 'client_approved' ? 'ring-2 ring-green-500 ring-opacity-50' :
        job.stage_status === 'changes_requested' ? 'ring-2 ring-red-500 ring-opacity-50' :
        ''
      }
    `}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Job Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{job.wo_no}</h4>
            <Badge 
              variant={job.stage_status === 'active' ? 'default' : 'secondary'}
              className={
                job.stage_status === 'active' ? 'bg-green-500' :
                job.stage_status === 'client_approved' ? 'bg-blue-500' :
                job.stage_status === 'changes_requested' ? 'bg-red-500' :
                ''
              }
            >
              {job.stage_status.replace('_', ' ')}
            </Badge>
          </div>

          {/* Job Details */}
          <div className="text-sm text-gray-600">
            <div>Customer: {job.customer}</div>
            {job.due_date && (
              <div>Due: {new Date(job.due_date).toLocaleDateString()}</div>
            )}
          </div>

          {/* Proof Status */}
          {isProofStage && (
            <ProofStatusIndicator stageInstance={job} />
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {canStartStage && (
              <Button
                size="sm"
                onClick={() => onStart(job.id)}
                disabled={isProcessing}
              >
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}

            {canCompleteStage && (
              <Button
                size="sm"
                onClick={() => onComplete(job.id)}
                disabled={isProcessing}
                variant="outline"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Complete
              </Button>
            )}

            {canSendProof && (
              <Button
                size="sm"
                onClick={() => onSendProof(job.id)}
                variant="outline"
              >
                <Mail className="h-3 w-3 mr-1" />
                Send Proof
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
