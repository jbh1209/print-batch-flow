
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, GripVertical, Clock, CheckCircle, AlertCircle } from "lucide-react";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WorkflowStageCardProps {
  stage: {
    id: string;
    stage_order: number;
    estimated_duration_hours: number;
    is_required: boolean;
    production_stage: {
      id: string;
      name: string;
      color: string;
      description?: string;
    };
  };
  onUpdate: (id: string, duration: number) => void;
  onRemove: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  totalStages: number;
}

export const WorkflowStageCard = ({ 
  stage, 
  onUpdate, 
  onRemove, 
  isFirst = false, 
  isLast = false,
  totalStages 
}: WorkflowStageCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-50 z-50' : ''}`}
    >
      {/* Connection Line */}
      {!isLast && (
        <div className="absolute left-8 top-full w-0.5 h-4 bg-gray-300 z-10" />
      )}
      
      <Card className={`bg-white border-2 ${isDragging ? 'border-blue-500 shadow-lg' : 'border-gray-200'} hover:border-gray-300 transition-colors`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing flex-shrink-0 mt-1"
            >
              <GripVertical className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </div>
            
            {/* Stage Indicator */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm"
                style={{ backgroundColor: stage.production_stage.color }}
              >
                {stage.stage_order}
              </div>
              {isFirst && (
                <Badge variant="outline" className="text-xs mt-1 bg-green-50 text-green-700 border-green-200">
                  Start
                </Badge>
              )}
              {isLast && (
                <Badge variant="outline" className="text-xs mt-1 bg-blue-50 text-blue-700 border-blue-200">
                  Final
                </Badge>
              )}
            </div>
            
            {/* Stage Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900 truncate">
                  {stage.production_stage.name}
                </h4>
                {stage.is_required && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
              
              {stage.production_stage.description && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                  {stage.production_stage.description}
                </p>
              )}
              
              {/* Duration Input */}
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <Input
                  type="number"
                  value={stage.estimated_duration_hours}
                  onChange={(e) => onUpdate(stage.id, parseInt(e.target.value) || 1)}
                  className="w-20 h-8"
                  min="1"
                  max="168"
                />
                <span className="text-sm text-gray-500">hours</span>
              </div>
              
              {/* Stage Metrics */}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>Step {stage.stage_order} of {totalStages}</span>
                <span>•</span>
                <span>{stage.estimated_duration_hours}h estimated</span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(stage.id)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
