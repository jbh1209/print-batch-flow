import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Eye,
  EyeOff,
  RotateCcw,
  Settings2
} from "lucide-react";
import type { ConsolidatedStage } from "@/utils/tracker/stageConsolidation";

interface FactoryFloorPreferences {
  hiddenStages: string[];
}

interface FactoryFloorSettingsProps {
  stages: ConsolidatedStage[];
  preferences: FactoryFloorPreferences;
  onToggleStage: (stageId: string) => void;
  onReset: () => void;
}

export const FactoryFloorSettings: React.FC<FactoryFloorSettingsProps> = ({
  stages,
  preferences,
  onToggleStage,
  onReset
}) => {
  const visibleStages = stages.filter(stage => !preferences.hiddenStages.includes(stage.stage_id));
  const hiddenStages = stages.filter(stage => preferences.hiddenStages.includes(stage.stage_id));

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Customize Factory Floor View
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Stage Visibility</h4>
            <p className="text-xs text-muted-foreground">
              Show/hide stages to focus on your current work
            </p>
          </div>
          <Button
            onClick={onReset}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Default
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Visible Stages */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-green-700 flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Visible Stages ({visibleStages.length})
            </h5>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {visibleStages.map((stage) => (
                <div
                  key={stage.stage_id}
                  className="flex items-center justify-between p-2 bg-green-50 rounded-md border border-green-200"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stage.stage_color }}
                    ></div>
                    <span className="text-sm truncate">{stage.stage_name}</span>
                    {stage.is_master_queue && (
                      <Badge variant="secondary" className="text-xs">
                        Master
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={true}
                    onCheckedChange={() => onToggleStage(stage.stage_id)}
                  />
                </div>
              ))}
              {visibleStages.length === 0 && (
                <p className="text-xs text-muted-foreground italic p-2">
                  No visible stages - at least one stage should be visible
                </p>
              )}
            </div>
          </div>

          {/* Hidden Stages */}
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-gray-700 flex items-center gap-1">
              <EyeOff className="h-3 w-3" />
              Hidden Stages ({hiddenStages.length})
            </h5>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {hiddenStages.map((stage) => (
                <div
                  key={stage.stage_id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-200 opacity-75"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full opacity-50" 
                      style={{ backgroundColor: stage.stage_color }}
                    ></div>
                    <span className="text-sm truncate text-muted-foreground">{stage.stage_name}</span>
                    {stage.is_master_queue && (
                      <Badge variant="outline" className="text-xs">
                        Master
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={false}
                    onCheckedChange={() => onToggleStage(stage.stage_id)}
                  />
                </div>
              ))}
              {hiddenStages.length === 0 && (
                <p className="text-xs text-muted-foreground italic p-2">
                  No hidden stages
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <strong>Tip:</strong> Hide stages you don't currently work on to focus your view. 
          You can always show them again later. Master queues group multiple related stages together.
        </div>
      </CardContent>
    </Card>
  );
};