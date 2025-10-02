import React from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobPaperSpecEditor } from "@/hooks/tracker/useJobPaperSpecEditor";

interface PaperSpecificationEditorProps {
  jobId: string;
  jobTableName: string;
  stageName: string;
  onRefresh?: () => void;
}

export const PaperSpecificationEditor: React.FC<PaperSpecificationEditorProps> = ({
  jobId,
  jobTableName,
  stageName,
  onRefresh
}) => {
  const {
    paperTypes,
    paperWeights,
    currentSpecs,
    isLoading,
    updatePaperSpecification,
    refreshSpecs
  } = useJobPaperSpecEditor(jobId, jobTableName);

  const handlePaperTypeChange = async (value: string) => {
    const success = await updatePaperSpecification('paper_type', value);
    if (success) {
      refreshSpecs();
      onRefresh?.();
    }
  };

  const handlePaperWeightChange = async (value: string) => {
    const success = await updatePaperSpecification('paper_weight', value);
    if (success) {
      refreshSpecs();
      onRefresh?.();
    }
  };

  return (
    <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-800">
          Paper Specifications for {stageName}
        </span>
      </div>

      {/* Current Specs Display */}
      <div className="flex flex-wrap gap-2">
        {currentSpecs.paper_type_name ? (
          <Badge className="bg-amber-100 text-amber-800">
            Type: {currentSpecs.paper_type_name}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-600">
            No Paper Type
          </Badge>
        )}
        {currentSpecs.paper_weight_name ? (
          <Badge className="bg-amber-100 text-amber-800">
            Weight: {currentSpecs.paper_weight_name}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-600">
            No Paper Weight
          </Badge>
        )}
      </div>

      {/* Paper Type Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Change Paper Type:</Label>
        <Select
          value={currentSpecs.paper_type_id || ''}
          onValueChange={handlePaperTypeChange}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select paper type" />
          </SelectTrigger>
          <SelectContent>
            {paperTypes.map(paperType => (
              <SelectItem key={paperType.id} value={paperType.id}>
                {paperType.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Paper Weight Selector */}
      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Change Paper Weight:</Label>
        <Select
          value={currentSpecs.paper_weight_id || ''}
          onValueChange={handlePaperWeightChange}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select paper weight" />
          </SelectTrigger>
          <SelectContent>
            {paperWeights.map(paperWeight => (
              <SelectItem key={paperWeight.id} value={paperWeight.id}>
                {paperWeight.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
