
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Clock, Trash2, Check, X, Edit, Settings } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface WorkflowStageCardProps {
  stage: {
    id: string;
    stage_order: number;
    estimated_duration_hours: number;
    is_required: boolean;
    applies_to_parts: string[];
    part_rule_type: 'all_parts' | 'specific_parts' | 'exclude_parts';
    part_name?: string; // For job instances
      production_stage: {
        id: string;
        name: string;
        color: string;
        description?: string;
      };
  };
  onUpdate: (id: string, duration: number) => void;
  onRemove: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
  totalStages: number;
  isJobInstance?: boolean; // New prop to indicate if this is a job instance view
}

export const WorkflowStageCard = ({ 
  stage, 
  onUpdate, 
  onRemove, 
  isFirst, 
  isLast, 
  totalStages,
  isJobInstance = false
}: WorkflowStageCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDuration, setEditDuration] = useState(stage.estimated_duration_hours);

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

  const handleSave = () => {
    onUpdate(stage.id, editDuration);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditDuration(stage.estimated_duration_hours);
    setIsEditing(false);
  };

  const getPartRuleDescription = () => {
    const { part_rule_type, applies_to_parts, production_stage } = stage;
    
    // If this is a job instance with a specific part assigned, show that
    if (isJobInstance && stage.part_name) {
      return `Part: ${stage.part_name}`;
    }
    
    // If not a job instance or no part name, don't show part info
    if (!isJobInstance || !stage.part_name) {
      return null;
    }

    // For workflow template configuration, show the rules
    if (!isJobInstance) {
      switch (part_rule_type) {
        case 'specific_parts':
          return applies_to_parts.length > 0 
            ? `Only: ${applies_to_parts.join(', ')}`
            : null; // Don't show "No parts selected" - just show nothing
        case 'exclude_parts':
          return applies_to_parts.length > 0 
            ? `All except: ${applies_to_parts.join(', ')}`
            : 'All parts';
        default:
          return null;
      }
    }

    return null;
  };

  const getEffectiveParts = () => {
    const { part_rule_type, applies_to_parts, production_stage } = stage;
    
    // If this is a job instance with a specific part, show that part
    if (isJobInstance && stage.part_name) {
      return [stage.part_name];
    }
    
    // Simplified - no multi-part support
    return [];
  };

  const partRuleDescription = getPartRuleDescription();
  const effectiveParts = getEffectiveParts();

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`transition-all duration-200 ${isDragging ? 'opacity-50 shadow-lg scale-105' : 'hover:shadow-md'}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-4 w-4" />
          </div>

          {/* Stage Order Badge */}
          <Badge variant="outline" className="min-w-[2rem] justify-center">
            {stage.stage_order}
          </Badge>

          {/* Stage Color Indicator */}
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.production_stage.color }}
          />

          {/* Stage Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm truncate">{stage.production_stage.name}</h4>
              {!stage.is_required && (
                <Badge variant="outline" className="text-xs">Optional</Badge>
              )}
            </div>
            
            {stage.production_stage.description && (
              <p className="text-xs text-gray-500 truncate">{stage.production_stage.description}</p>
            )}

            {/* Part-specific information */}
            {partRuleDescription && (
              <div className="mt-1">
                <span className="text-xs text-blue-600 font-medium">{partRuleDescription}</span>
              </div>
            )}

            {effectiveParts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {effectiveParts.map(part => (
                  <Badge key={part} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    {part}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-gray-400" />
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={editDuration}
                  onChange={(e) => setEditDuration(parseInt(e.target.value) || 0)}
                  className="w-16 h-7 text-xs"
                  min="1"
                  max="168"
                />
                <Button size="sm" variant="ghost" onClick={handleSave} className="h-7 w-7 p-0">
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 w-7 p-0">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium">{stage.estimated_duration_hours}h</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setIsEditing(true)}
                  className="h-6 w-6 p-0"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Remove Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRemove(stage.id)}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
