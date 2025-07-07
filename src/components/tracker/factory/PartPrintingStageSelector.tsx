
import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface PrintingStage {
  stage_id: string;
  stage_name: string;
  stage_color: string;
  part_types: string[];
}

interface PartAssignment {
  partName: string;
  stageId: string;
}

interface PartPrintingStageSelectorProps {
  availableParts: string[];
  onPartAssignmentsChange: (assignments: Record<string, string>) => void;
  initialAssignments?: Record<string, string>;
}

export const PartPrintingStageSelector: React.FC<PartPrintingStageSelectorProps> = ({
  availableParts,
  onPartAssignmentsChange,
  initialAssignments = {}
}) => {
  const [printingStages, setPrintingStages] = useState<PrintingStage[]>([]);
  const [partAssignments, setPartAssignments] = useState<Record<string, string>>(initialAssignments);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPrintingStages = async () => {
      try {
        const { data, error } = await supabase.rpc('get_printing_stages_for_parts');
        if (error) throw error;
        setPrintingStages(data || []);
      } catch (error) {
        console.error('Error loading printing stages:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadPrintingStages();
  }, []);

  const handlePartAssignment = (partName: string, stageId: string) => {
    const newAssignments = { ...partAssignments, [partName]: stageId };
    setPartAssignments(newAssignments);
    onPartAssignmentsChange(newAssignments);
  };

  const getStageDisplayName = (stageName: string) => {
    // Clean up stage names for better display
    return stageName.replace(/printing/i, 'Printer').trim();
  };

  const getPartDisplayName = (partName: string) => {
    return partName.charAt(0).toUpperCase() + partName.slice(1);
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading printing stages...</div>;
  }

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Assign Parts to Printing Stages</Label>
      
      {availableParts.map((partName) => (
        <div key={partName} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline"
              className={partName.toLowerCase() === 'cover' ? 'border-blue-300 text-blue-700' : 'border-green-300 text-green-700'}
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
              <SelectValue placeholder={`Select printer for ${getPartDisplayName(partName)}...`} />
            </SelectTrigger>
            <SelectContent>
              {printingStages.map((stage) => (
                <SelectItem key={stage.stage_id} value={stage.stage_id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stage.stage_color }}
                    />
                    <span>{getStageDisplayName(stage.stage_name)}</span>
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
