import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Settings, Calculator, Copy, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface StageConfig {
  id: string;
  name: string;
  color: string;
  order: number;
  quantity?: number | null;
  estimatedDurationMinutes?: number | null;
  partAssignment?: 'cover' | 'text' | 'both' | null;
  stageSpecificationId?: string | null;
}

interface StageConfigurationStepProps {
  stages: StageConfig[];
  onStageReorder: (result: any) => void;
  onStageUpdate: (stageId: string, updates: Partial<StageConfig>) => void;
  onBulkUpdate: (updates: Partial<StageConfig>) => void;
  onCalculateDurations: () => void;
  jobQuantity: number;
  isCalculatingDurations?: boolean;
}

export const StageConfigurationStep: React.FC<StageConfigurationStepProps> = ({
  stages,
  onStageReorder,
  onStageUpdate,
  onBulkUpdate,
  onCalculateDurations,
  jobQuantity,
  isCalculatingDurations = false
}) => {
  const [bulkQuantity, setBulkQuantity] = useState<string>(jobQuantity.toString());
  const [bulkDuration, setBulkDuration] = useState<string>('');
  const [bulkPartAssignment, setBulkPartAssignment] = useState<string>('');

  const getConfigurationStatus = (stage: StageConfig) => {
    const hasQuantity = stage.quantity != null;
    const hasDuration = stage.estimatedDurationMinutes != null;
    const hasPartAssignment = stage.partAssignment != null;
    
    const configuredCount = [hasQuantity, hasDuration, hasPartAssignment].filter(Boolean).length;
    const totalCount = 3;
    
    if (configuredCount === totalCount) return { status: 'complete', icon: CheckCircle, color: 'text-green-600' };
    if (configuredCount > 0) return { status: 'partial', icon: Clock, color: 'text-yellow-600' };
    return { status: 'empty', icon: AlertCircle, color: 'text-gray-400' };
  };

  const applyBulkUpdates = () => {
    const updates: Partial<StageConfig> = {};
    
    if (bulkQuantity) {
      const quantity = parseInt(bulkQuantity);
      if (!isNaN(quantity)) updates.quantity = quantity;
    }
    
    if (bulkDuration) {
      const duration = parseInt(bulkDuration);
      if (!isNaN(duration)) updates.estimatedDurationMinutes = duration;
    }
    
    if (bulkPartAssignment && bulkPartAssignment !== '') {
      updates.partAssignment = bulkPartAssignment as 'cover' | 'text' | 'both';
    }
    
    onBulkUpdate(updates);
    
    // Clear bulk inputs
    setBulkQuantity('');
    setBulkDuration('');
    setBulkPartAssignment('');
  };

  const completeStages = stages.filter(stage => getConfigurationStatus(stage).status === 'complete').length;
  const partialStages = stages.filter(stage => getConfigurationStatus(stage).status === 'partial').length;

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Configuration Progress</span>
            <div className="flex space-x-4 text-sm">
              <span className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{completeStages} Complete</span>
              </span>
              <span className="flex items-center space-x-1 text-yellow-600">
                <Clock className="h-4 w-4" />
                <span>{partialStages} Partial</span>
              </span>
              <span className="flex items-center space-x-1 text-gray-500">
                <AlertCircle className="h-4 w-4" />
                <span>{stages.length - completeStages - partialStages} Empty</span>
              </span>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Bulk Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <Copy className="h-4 w-4" />
            <span>Bulk Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="bulk-quantity">Quantity for All</Label>
              <Input
                id="bulk-quantity"
                type="number"
                placeholder={`Default: ${jobQuantity}`}
                value={bulkQuantity}
                onChange={(e) => setBulkQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bulk-duration">Duration (min)</Label>
              <Input
                id="bulk-duration"
                type="number"
                placeholder="e.g., 60"
                value={bulkDuration}
                onChange={(e) => setBulkDuration(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bulk-part">Part Assignment</Label>
              <Select value={bulkPartAssignment} onValueChange={setBulkPartAssignment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select part" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No assignment</SelectItem>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end space-y-2">
              <Button onClick={applyBulkUpdates} size="sm">
                Apply to All
              </Button>
              <Button 
                onClick={onCalculateDurations} 
                size="sm" 
                variant="outline"
                disabled={isCalculatingDurations}
                className="flex items-center space-x-1"
              >
                <Calculator className="h-3 w-3" />
                <span>{isCalculatingDurations ? 'Calculating...' : 'Auto-Calculate'}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage Configuration List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Stage Order & Configuration ({stages.length} stages)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={onStageReorder}>
            <Droppable droppableId="stage-configuration">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-3 min-h-[100px] ${
                    snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg p-2' : ''
                  }`}
                >
                  {stages.map((stage, index) => {
                    const { status, icon: StatusIcon, color } = getConfigurationStatus(stage);
                    
                    return (
                      <Draggable key={stage.id} draggableId={stage.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`border rounded-lg p-4 bg-white ${
                              snapshot.isDragging ? 'shadow-lg rotate-1' : 'hover:shadow-sm'
                            } transition-all`}
                          >
                            <div className="flex items-start space-x-3">
                              <div {...provided.dragHandleProps} className="mt-1">
                                <GripVertical className="h-5 w-5 text-gray-400" />
                              </div>
                              
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <Badge 
                                      variant="outline" 
                                      style={{ 
                                        backgroundColor: `${stage.color}20`, 
                                        color: stage.color, 
                                        borderColor: `${stage.color}40` 
                                      }}
                                    >
                                      {index + 1}. {stage.name}
                                    </Badge>
                                    <StatusIcon className={`h-4 w-4 ${color}`} />
                                    <span className={`text-xs ${color} capitalize`}>{status}</span>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <Label className="text-xs">Quantity</Label>
                                    <Input
                                      type="number"
                                      value={stage.quantity || ''}
                                      onChange={(e) => onStageUpdate(stage.id, { 
                                        quantity: e.target.value ? parseInt(e.target.value) : null 
                                      })}
                                      placeholder={jobQuantity.toString()}
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Duration (min)</Label>
                                    <Input
                                      type="number"
                                      value={stage.estimatedDurationMinutes || ''}
                                      onChange={(e) => onStageUpdate(stage.id, { 
                                        estimatedDurationMinutes: e.target.value ? parseInt(e.target.value) : null 
                                      })}
                                      placeholder="Auto-calculate"
                                      className="h-8"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Part Assignment</Label>
                                    <Select 
                                      value={stage.partAssignment || ''} 
                                      onValueChange={(value) => onStageUpdate(stage.id, { 
                                        partAssignment: value as 'cover' | 'text' | 'both' | null || null 
                                      })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Select part" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="">No assignment</SelectItem>
                                        <SelectItem value="cover">Cover</SelectItem>
                                        <SelectItem value="text">Text</SelectItem>
                                        <SelectItem value="both">Both</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      {stages.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Configuration Summary</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-700">
            <div>
              <strong>Total Stages:</strong> {stages.length}
            </div>
            <div>
              <strong>Total Quantity:</strong> {stages.reduce((sum, stage) => sum + (stage.quantity || 0), 0)}
            </div>
            <div>
              <strong>Estimated Duration:</strong> {Math.round(stages.reduce((sum, stage) => sum + (stage.estimatedDurationMinutes || 0), 0) / 60 * 10) / 10}h
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Review your configuration above. You can drag stages to reorder them or use bulk operations to configure multiple stages at once.
          </p>
        </div>
      )}
    </div>
  );
};