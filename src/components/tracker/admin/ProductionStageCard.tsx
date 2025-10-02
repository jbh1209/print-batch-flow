import React from "react";
import { Badge } from "@/components/ui/badge";
import { ProductionStageActions } from "./ProductionStageActions";
import { Split, Clock, Gauge, Settings, ArrowLeftRight } from "lucide-react";
import { stagingHelpers } from "@/hooks/tracker/stagingSystemUtils";
import type { ProductionStage } from "@/hooks/tracker/useProductionStages";


interface ProductionStageCardProps {
  stage: ProductionStage;
  maxOrderIndex: number;
  onMoveStage: (stageId: string, direction: 'up' | 'down') => Promise<void>;
  onStageUpdate: () => void;
  onDeleteStage: (stageId: string) => Promise<boolean>;
  allStages?: ProductionStage[];
}

export const ProductionStageCard: React.FC<ProductionStageCardProps> = ({
  stage,
  maxOrderIndex,
  onMoveStage,
  onStageUpdate,
  onDeleteStage,
  allStages = []
}) => {
  const hasTimingData = stagingHelpers.hasTimingData(stage);
  
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium">{stage.name}</h3>
            <Badge variant="outline">Order: {stage.order_index}</Badge>
            {!stage.is_active && <Badge variant="secondary">Inactive</Badge>}
            {stage.supports_parts && (
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                <Split className="h-3 w-3 mr-1" />
                Parts Support
              </Badge>
            )}
            {hasTimingData && (
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                <Clock className="h-3 w-3 mr-1" />
                Timing Enabled
              </Badge>
            )}
            {stage.allow_gap_filling && (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                <ArrowLeftRight className="h-3 w-3 mr-1" />
                Gap-Filling Enabled
              </Badge>
            )}
          </div>
          
          {stage.description && (
            <p className="text-sm text-gray-600 mb-2">{stage.description}</p>
          )}
          
          {/* Enhanced Timing Display */}
          {hasTimingData && (
            <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Gauge className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Speed:</span>
                <span className="text-blue-700">
                  {stagingHelpers.formatSpeed(stage.running_speed_per_hour || 0, stage.speed_unit || 'sheets_per_hour')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Setup:</span>
                <span className="text-blue-700">
                  {stagingHelpers.formatDuration(stage.make_ready_time_minutes || 10)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <ProductionStageActions
        stage={stage}
        maxOrderIndex={maxOrderIndex}
        onMoveStage={onMoveStage}
        onStageUpdate={onStageUpdate}
        onDeleteStage={onDeleteStage}
      />
    </div>
  );
};