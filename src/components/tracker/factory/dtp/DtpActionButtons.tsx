
import React from "react";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Mail, ArrowRight } from "lucide-react";

interface DtpActionButtonsProps {
  currentStage: 'dtp' | 'proof' | 'unknown';
  stageStatus: string;
  isLoading: boolean;
  onStartDtp: () => void;
  onCompleteDtp: () => void;
  onStartProof: () => void;
  onProofEmailed: () => void;
}

export const DtpActionButtons: React.FC<DtpActionButtonsProps> = ({
  currentStage,
  stageStatus,
  isLoading,
  onStartDtp,
  onCompleteDtp,
  onStartProof,
  onProofEmailed
}) => {
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

  if (currentStage === 'unknown') {
    return (
      <div className="text-center text-gray-500">
        Stage not recognized or no actions available
      </div>
    );
  }

  return null;
};
