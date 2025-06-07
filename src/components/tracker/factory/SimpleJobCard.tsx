
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
  
  // Simplified logic - much cleaner than complex permission checks
  const canStartStage = job.stage_status === 'pending';
  const canCompleteStage = job.stage_status === 'active' || job.stage_status === 'client_approved';
  const canSendProof = isProofStage && job.stage_status === 'active';

  const getStatusColor = () => {
    switch (job.stage_status) {
      case 'active': return 'ring-2 ring-blue-500 ring-opacity-50';
      case 'client_approved': return 'ring-2 ring-green-500 ring-opacity-50';
      case 'changes_requested': return 'ring-2 ring-red-500 ring-opacity-50';
      case 'awaiting_approval': return 'ring-2 ring-yellow-500 ring-opacity-50';
      default: return '';
    }
  };

  const getStatusBadge = () => {
    const statusMap = {
      'pending': { variant: 'secondary' as const, color: '' },
      'active': { variant: 'default' as const, color: 'bg-green-500' },
      'client_approved': { variant: 'default' as const, color: 'bg-blue-500' },
      'changes_requested': { variant: 'default' as const, color: 'bg-red-500' },
      'awaiting_approval': { variant: 'default' as const, color: 'bg-yellow-500' },
      'completed': { variant: 'default' as const, color: 'bg-gray-500' }
    };

    const config = statusMap[job.stage_status as keyof typeof statusMap] || statusMap.pending;
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {job.stage_status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <Card className={getStatusColor()}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Job Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{job.wo_no}</h4>
            {getStatusBadge()}
          </div>

          {/* Job Details */}
          <div className="text-sm text-gray-600">
            <div>Customer: {job.customer}</div>
            {job.due_date && (
              <div>Due: {new Date(job.due_date).toLocaleDateString()}</div>
            )}
            <div>Stage: {job.stage_name}</div>
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
