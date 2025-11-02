import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import { ChevronDown, X } from 'lucide-react';
import { FINISHING_PRESETS, getPresetForStages } from './FinishingStagePresets';

interface FinishingStageSelectorProps {
  availableStages: Array<{ id: string; name: string }>;
  selectedStageIds: string[];
  onSelectionChange: (stageIds: string[]) => void;
}

export const FinishingStageSelector: React.FC<FinishingStageSelectorProps> = ({
  availableStages,
  selectedStageIds,
  onSelectionChange
}) => {
  const [open, setOpen] = useState(false);

  const handlePresetClick = (stageNames: string[]) => {
    const stageIds = availableStages
      .filter(stage => stageNames.includes(stage.name))
      .map(stage => stage.id);
    onSelectionChange(stageIds);
    setOpen(false);
  };

  const handleStageToggle = (stageId: string) => {
    if (selectedStageIds.includes(stageId)) {
      onSelectionChange(selectedStageIds.filter(id => id !== stageId));
    } else {
      onSelectionChange([...selectedStageIds, stageId]);
    }
  };

  const handleRemoveStage = (stageId: string) => {
    onSelectionChange(selectedStageIds.filter(id => id !== stageId));
  };

  const selectedStageNames = availableStages
    .filter(stage => selectedStageIds.includes(stage.id))
    .map(stage => stage.name);

  const currentPreset = getPresetForStages(selectedStageNames);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <span className="text-sm">
                {currentPreset ? currentPreset.label : 'Select Stages'}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Quick Presets</DropdownMenuLabel>
            {FINISHING_PRESETS.map(preset => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => handlePresetClick(preset.stages)}
                className="flex flex-col items-start py-2"
              >
                <span className="font-medium">{preset.label}</span>
                {preset.description && (
                  <span className="text-xs text-muted-foreground">{preset.description}</span>
                )}
              </DropdownMenuItem>
            ))}
            
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Custom Selection</DropdownMenuLabel>
            {availableStages.map(stage => (
              <DropdownMenuCheckboxItem
                key={stage.id}
                checked={selectedStageIds.includes(stage.id)}
                onCheckedChange={() => handleStageToggle(stage.id)}
              >
                {stage.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedStageIds.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {availableStages
              .filter(stage => selectedStageIds.includes(stage.id))
              .map(stage => (
                <Badge
                  key={stage.id}
                  variant="secondary"
                  className="flex items-center gap-1 pl-2 pr-1"
                >
                  <span>{stage.name}</span>
                  <button
                    onClick={() => handleRemoveStage(stage.id)}
                    className="ml-1 hover:bg-muted rounded-sm p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
          </div>
        )}
      </div>

      {selectedStageIds.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Select stages to view in multi-column mode
        </p>
      )}
    </div>
  );
};
