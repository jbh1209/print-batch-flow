
import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";

interface PrintingStage {
  id: string;
  name: string;
  color: string;
}

interface ProofAdvancementSectionProps {
  showPartSelector: boolean;
  jobParts: string[];
  partAssignments: Record<string, string>;
  onPartAssignmentsChange: (assignments: Record<string, string>) => void;
  printingStages: PrintingStage[];
  selectedPrintingStage: string;
  onSelectedPrintingStageChange: (stageId: string) => void;
  isAssigning: boolean;
  isLoading: boolean;
  onAdvanceToPartSpecificPrinting: () => void;
  onAdvanceToPrintingStage: () => void;
}

export const ProofAdvancementSection: React.FC<ProofAdvancementSectionProps> = ({
  showPartSelector,
  jobParts,
  partAssignments,
  onPartAssignmentsChange,
  printingStages,
  selectedPrintingStage,
  onSelectedPrintingStageChange,
  isAssigning,
  isLoading,
  onAdvanceToPartSpecificPrinting,
  onAdvanceToPrintingStage
}) => {
  if (showPartSelector) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-600">
          Multi-part printing not available in simplified mode
        </div>
        <Button 
          onClick={onAdvanceToPartSpecificPrinting}
          disabled={true}
          className="w-full"
        >
          <ArrowRight className="h-4 w-4 mr-1" />
          Multi-part Not Available
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Select Printing Stage:</Label>
      <div className="flex gap-2">
        <Select value={selectedPrintingStage} onValueChange={onSelectedPrintingStageChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choose printing stage..." />
          </SelectTrigger>
          <SelectContent>
            {printingStages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          onClick={onAdvanceToPrintingStage}
          disabled={!selectedPrintingStage || isLoading}
          size="sm"
        >
          <ArrowRight className="h-4 w-4 mr-1" />
          Advance
        </Button>
      </div>
    </div>
  );
};
