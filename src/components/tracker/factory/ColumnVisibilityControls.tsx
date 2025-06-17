
import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuCheckboxItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Eye, Grid2X2, Grid3X3, MoreHorizontal, Columns } from "lucide-react";
import { ConsolidatedStage } from "@/utils/tracker/stageConsolidation";

interface ColumnVisibilityControlsProps {
  stages: ConsolidatedStage[];
  visibleStageIds: Set<string>;
  onToggleStage: (stageId: string) => void;
  layout: '2-col' | '3-col' | '4-col';
  onLayoutChange: (layout: '2-col' | '3-col' | '4-col') => void;
}

export const ColumnVisibilityControls: React.FC<ColumnVisibilityControlsProps> = ({
  stages,
  visibleStageIds,
  onToggleStage,
  layout,
  onLayoutChange
}) => {
  const layoutIcons = {
    '2-col': Grid2X2,
    '3-col': Grid3X3,
    '4-col': MoreHorizontal
  };

  const layoutLabels = {
    '2-col': '2 Columns',
    '3-col': '3 Columns', 
    '4-col': '4 Columns'
  };

  const CurrentLayoutIcon = layoutIcons[layout];

  return (
    <div className="flex items-center gap-2">
      {/* Layout Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CurrentLayoutIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{layoutLabels[layout]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Layout</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.entries(layoutLabels).map(([key, label]) => {
            const Icon = layoutIcons[key as keyof typeof layoutIcons];
            return (
              <DropdownMenuCheckboxItem
                key={key}
                checked={layout === key}
                onCheckedChange={() => onLayoutChange(key as '2-col' | '3-col' | '4-col')}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Column Visibility */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Columns</span>
            <Badge variant="secondary" className="ml-1">
              {visibleStageIds.size}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Columns className="h-4 w-4" />
            Visible Stages ({visibleStageIds.size}/{stages.length})
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {stages.length > 0 ? (
            stages.map(stage => (
              <DropdownMenuCheckboxItem
                key={stage.stage_id}
                checked={visibleStageIds.has(stage.stage_id)}
                onCheckedChange={() => onToggleStage(stage.stage_id)}
              >
                <div className="flex items-center gap-2 w-full">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: stage.stage_color }}
                  />
                  <span className="truncate">{stage.stage_name}</span>
                  {stage.is_master_queue && (
                    <Badge variant="outline" className="text-xs ml-auto">
                      Queue
                    </Badge>
                  )}
                </div>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <div className="px-2 py-3 text-sm text-gray-500 text-center">
              No accessible stages found
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
