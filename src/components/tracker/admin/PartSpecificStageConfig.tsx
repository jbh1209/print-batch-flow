
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Info, Plus, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PartSpecificStageConfigProps {
  selectedStageId: string;
  availableParts: string[];
  currentConfig: {
    part_rule_type: 'all_parts' | 'specific_parts' | 'exclude_parts';
    applies_to_parts: string[];
  };
  onConfigChange: (config: {
    part_rule_type: 'all_parts' | 'specific_parts' | 'exclude_parts';
    applies_to_parts: string[];
  }) => void;
  stageName?: string;
}

export const PartSpecificStageConfig = ({
  selectedStageId,
  availableParts,
  currentConfig,
  onConfigChange,
  stageName
}: PartSpecificStageConfigProps) => {
  if (!selectedStageId || availableParts.length === 0) {
    return null;
  }

  const handleRuleTypeChange = (ruleType: 'all_parts' | 'specific_parts' | 'exclude_parts') => {
    onConfigChange({
      part_rule_type: ruleType,
      applies_to_parts: ruleType === 'all_parts' ? [] : currentConfig.applies_to_parts
    });
  };

  const handlePartToggle = (partName: string, checked: boolean) => {
    const updatedParts = checked
      ? [...currentConfig.applies_to_parts, partName]
      : currentConfig.applies_to_parts.filter(p => p !== partName);
    
    onConfigChange({
      ...currentConfig,
      applies_to_parts: updatedParts
    });
  };

  const getRuleDescription = () => {
    switch (currentConfig.part_rule_type) {
      case 'all_parts':
        return "This stage will apply to all parts in multi-part production stages.";
      case 'specific_parts':
        return "This stage will only apply to the selected parts.";
      case 'exclude_parts':
        return "This stage will apply to all parts except the selected ones.";
      default:
        return "";
    }
  };

  const getEffectiveParts = () => {
    switch (currentConfig.part_rule_type) {
      case 'all_parts':
        return availableParts;
      case 'specific_parts':
        return currentConfig.applies_to_parts;
      case 'exclude_parts':
        return availableParts.filter(part => !currentConfig.applies_to_parts.includes(part));
      default:
        return [];
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Part-Specific Configuration
          {stageName && <span className="text-gray-500">for {stageName}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Configure which parts this stage applies to when used in multi-part production workflows.
          </AlertDescription>
        </Alert>

        {/* Rule Type Selection */}
        <div>
          <Label htmlFor="rule-type">Application Rule</Label>
          <Select 
            value={currentConfig.part_rule_type} 
            onValueChange={handleRuleTypeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select how this stage applies to parts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_parts">Apply to All Parts</SelectItem>
              <SelectItem value="specific_parts">Apply to Specific Parts Only</SelectItem>
              <SelectItem value="exclude_parts">Apply to All Except Selected Parts</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-600 mt-1">{getRuleDescription()}</p>
        </div>

        {/* Part Selection (only show if not all_parts) */}
        {currentConfig.part_rule_type !== 'all_parts' && (
          <div>
            <Label>
              {currentConfig.part_rule_type === 'specific_parts' ? 'Select Parts' : 'Exclude Parts'}
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {availableParts.map(partName => (
                <div key={partName} className="flex items-center space-x-2">
                  <Checkbox
                    id={`part-${partName}`}
                    checked={currentConfig.applies_to_parts.includes(partName)}
                    onCheckedChange={(checked) => handlePartToggle(partName, checked as boolean)}
                  />
                  <Label htmlFor={`part-${partName}`} className="text-sm font-normal">
                    {partName}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview of Effective Parts */}
        <div>
          <Label className="text-sm font-medium">This stage will apply to:</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {getEffectiveParts().map(partName => (
              <Badge key={partName} variant="secondary" className="text-xs">
                {partName}
              </Badge>
            ))}
            {getEffectiveParts().length === 0 && (
              <span className="text-sm text-gray-500 italic">No parts selected</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
