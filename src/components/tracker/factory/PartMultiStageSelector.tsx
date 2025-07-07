
import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface MultiPartStage {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  part_types: string[];
}

interface PartMultiStageSelectorProps {
  availableParts: string[];
  availableStages: MultiPartStage[];
  onPartAssignmentsChange: (assignments: Record<string, string>) => void;
  initialAssignments?: Record<string, string>;
}

export const PartMultiStageSelector: React.FC<PartMultiStageSelectorProps> = ({
  availableParts,
  availableStages,
  onPartAssignmentsChange,
  initialAssignments = {}
}) => {
  const [partAssignments, setPartAssignments] = useState<Record<string, string>>(initialAssignments);

  useEffect(() => {
    setPartAssignments(initialAssignments);
  }, [initialAssignments]);

  const handlePartAssignment = (partName: string, stageId: string) => {
    const newAssignments = { ...partAssignments, [partName]: stageId };
    setPartAssignments(newAssignments);
    onPartAssignmentsChange(newAssignments);
  };

  const getPartDisplayName = (partName: string) => {
    return partName.charAt(0).toUpperCase() + partName.slice(1);
  };

  const getPartColor = (partName: string) => {
    const lowerName = partName.toLowerCase();
    if (lowerName.includes('cover')) return 'border-blue-300 text-blue-700';
    if (lowerName.includes('text')) return 'border-green-300 text-green-700';
    return 'border-purple-300 text-purple-700';
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Assign Parts to Stages</Label>
      
      {availableParts.map((partName) => (
        <div key={partName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline"
              className={getPartColor(partName)}
            >
              {getPartDisplayName(partName)}
            </Badge>
            <span className="text-sm text-gray-600">→</span>
          </div>
          
          <Select 
            value={partAssignments[partName] || ''} 
            onValueChange={(stageId) => handlePartAssignment(partName, stageId)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={`Select stage for ${getPartDisplayName(partName)}...`} />
            </SelectTrigger>
            <SelectContent>
              {availableStages
                .filter(stage => stage.part_types.includes(partName))
                .map((stage) => (
                  <SelectItem key={stage.stage_id} value={stage.stage_id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.stage_color }}
                      />
                      <span>{stage.stage_name}</span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      
      {availableParts.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No parts available for assignment
        </div>
      )}
    </div>
  );
};
