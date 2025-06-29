
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, Play, CheckCircle, Mail, ArrowRight, Package } from 'lucide-react';
import { BatchAllocationSection } from './BatchAllocationSection';
import { AccessibleJob } from '@/hooks/tracker/useAccessibleJobs';

interface DtpWorkflowActionsProps {
  currentStage: string;
  stageStatus: string;
  isLoading: boolean;
  showPartSelector: boolean;
  jobParts: string[];
  partAssignments: Record<string, string>;
  printingStages: Array<{ id: string; name: string; color: string; }>;
  selectedPrintingStage: string;
  isAssigning: boolean;
  job?: AccessibleJob;
  onStartDtp: () => void;
  onCompleteDtp: () => void;
  onStartProof: () => void;
  onProofEmailed: () => void;
  onPartAssignmentsChange: (assignments: Record<string, string>) => void;
  onSelectedPrintingStageChange: (stageId: string) => void;
  onAdvanceToPartSpecificPrinting: () => void;
  onAdvanceToPrintingStage: () => void;
  onRefresh?: () => void;
}

export const DtpWorkflowActions: React.FC<DtpWorkflowActionsProps> = ({
  currentStage,
  stageStatus,
  isLoading,
  showPartSelector,
  jobParts,
  partAssignments,
  printingStages,
  selectedPrintingStage,
  isAssigning,
  job,
  onStartDtp,
  onCompleteDtp,
  onStartProof,
  onProofEmailed,
  onPartAssignmentsChange,
  onSelectedPrintingStageChange,
  onAdvanceToPartSpecificPrinting,
  onAdvanceToPrintingStage,
  onRefresh = () => {}
}) => {
  // DTP Stage Actions
  if (currentStage === 'dtp') {
    if (stageStatus === 'pending') {
      return (
        <Button 
          onClick={onStartDtp} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          Start DTP Work
        </Button>
      );
    }
    
    if (stageStatus === 'active') {
      return (
        <Button 
          onClick={onCompleteDtp}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
          Complete DTP Work
        </Button>
      );
    }
  }

  // Proof Stage Actions
  if (currentStage === 'proof') {
    if (stageStatus === 'pending') {
      return (
        <Button 
          onClick={onStartProof}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          Start Proof Stage
        </Button>
      );
    }
    
    if (stageStatus === 'active') {
      return (
        <div className="space-y-3">
          <Button 
            onClick={onProofEmailed}
            disabled={isLoading}
            className="w-full"
            variant="outline"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Mark Proof as Emailed
          </Button>
        </div>
      );
    }
  }

  // Batch Allocation Stage - NEW INTEGRATION POINT
  if (currentStage === 'batch allocation' || currentStage === 'batch_allocation') {
    if (job && onRefresh) {
      return <BatchAllocationSection job={job} onRefresh={onRefresh} />;
    }
  }

  // Proof Approved - Show batch allocation option
  if (currentStage === 'proof' && stageStatus === 'completed') {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium mb-2">✅ Proof Approved</p>
          <p className="text-sm text-green-700">Choose next step for this job:</p>
        </div>
        
        {/* Option 1: Batch Allocation */}
        {job && onRefresh && (
          <div className="space-y-2">
            <BatchAllocationSection job={job} onRefresh={onRefresh} />
          </div>
        )}
        
        {/* Option 2: Direct to Printing */}
        <div className="border-t pt-4">
          <Label className="text-sm font-medium text-gray-700 mb-3 block">
            Or proceed directly to printing:
          </Label>
          
          {showPartSelector ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Assign Parts to Printing Stages:</Label>
              {jobParts.map((part) => (
                <div key={part} className="space-y-2">
                  <Label className="text-sm capitalize">{part} Part:</Label>
                  <Select
                    value={partAssignments[part] || ''}
                    onValueChange={(value) => onPartAssignmentsChange({ ...partAssignments, [part]: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select printing stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {printingStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <Button
                onClick={onAdvanceToPartSpecificPrinting}
                disabled={isAssigning || Object.keys(partAssignments).length !== jobParts.length}
                className="w-full mt-3"
                variant="outline"
              >
                {isAssigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Assign to Printing Stages
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Select value={selectedPrintingStage} onValueChange={onSelectedPrintingStageChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select printing stage" />
                </SelectTrigger>
                <SelectContent>
                  {printingStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={onAdvanceToPrintingStage}
                disabled={!selectedPrintingStage || isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                Proceed to Printing
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
