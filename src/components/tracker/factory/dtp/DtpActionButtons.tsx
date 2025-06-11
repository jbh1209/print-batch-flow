
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Mail, Clock, ThumbsUp } from "lucide-react";

interface DtpActionButtonsProps {
  currentStage: 'dtp' | 'proof' | 'unknown';
  stageStatus: string;
  isLoading: boolean;
  proofEmailed?: boolean;
  proofEmailedAt?: string;
  onStartDtp: () => void;
  onCompleteDtp: () => void;
  onStartProof: () => void;
  onProofEmailed: () => void;
  onProofApproved?: () => void;
}

export const DtpActionButtons: React.FC<DtpActionButtonsProps> = ({
  currentStage,
  stageStatus,
  isLoading,
  proofEmailed = false,
  proofEmailedAt,
  onStartDtp,
  onCompleteDtp,
  onStartProof,
  onProofEmailed,
  onProofApproved
}) => {
  // Check if proof has been emailed based on timestamp or prop
  const hasProofBeenEmailed = proofEmailed || !!proofEmailedAt;

  if (currentStage === 'dtp') {
    if (stageStatus === 'pending') {
      return (
        <Button 
          onClick={onStartDtp}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start DTP Work
        </Button>
      );
    }

    if (stageStatus === 'active') {
      return (
        <Button 
          onClick={onCompleteDtp}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Complete DTP
        </Button>
      );
    }
  }

  if (currentStage === 'proof') {
    if (stageStatus === 'pending') {
      return (
        <Button 
          onClick={onStartProof}
          disabled={isLoading}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <Play className="h-4 w-4 mr-2" />
          Start Proof Process
        </Button>
      );
    }

    if (stageStatus === 'active') {
      if (hasProofBeenEmailed) {
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-md">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Awaiting Client Approval</span>
            </div>
            {proofEmailedAt && (
              <div className="text-xs text-gray-500 text-center">
                Sent: {new Date(proofEmailedAt).toLocaleDateString()} at {new Date(proofEmailedAt).toLocaleTimeString()}
              </div>
            )}
            {onProofApproved && (
              <Button 
                onClick={onProofApproved}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <ThumbsUp className="h-4 w-4 mr-2" />
                Mark as Approved
              </Button>
            )}
          </div>
        );
      } else {
        return (
          <Button 
            onClick={onProofEmailed}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            Proof Emailed
          </Button>
        );
      }
    }
  }

  if (currentStage === 'unknown') {
    return (
      <div className="text-center text-gray-500">
        Stage not recognized or no actions available
      </div>
    );
  }

  return null;
};
