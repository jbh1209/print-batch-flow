
import React from "react";
import { Badge } from "@/components/ui/badge";
import { ProductionStageActions } from "./ProductionStageActions";
import { Split } from "lucide-react";

interface ProductionStage {
  id: string;
  name: string;
  description?: string;
  order_index: number;
  color: string;
  is_active: boolean;
  is_multi_part: boolean;
  part_definitions: string[];
  master_queue_id?: string;
  supports_parts: boolean;
}

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
  const masterQueue = stage.master_queue_id 
    ? allStages.find(s => s.id === stage.master_queue_id)
    : null;

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{stage.name}</h3>
            <Badge variant="outline">Order: {stage.order_index}</Badge>
            {!stage.is_active && <Badge variant="secondary">Inactive</Badge>}
            {stage.is_multi_part && <Badge variant="default">Multi-Part</Badge>}
            {stage.supports_parts && (
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                <Split className="h-3 w-3 mr-1" />
                Parts Support
              </Badge>
            )}
            {masterQueue && (
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                → {masterQueue.name}
              </Badge>
            )}
          </div>
          {stage.description && (
            <p className="text-sm text-gray-600">{stage.description}</p>
          )}
          {stage.is_multi_part && stage.part_definitions.length > 0 && (
            <div className="flex gap-1 mt-1">
              {stage.part_definitions.map((part, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {part}
                </Badge>
              ))}
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
