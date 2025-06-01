
import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, X } from "lucide-react";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onSuccess: () => void;
}

interface SelectedStage {
  id: string;
  name: string;
  color: string;
  order: number;
}

export const CustomWorkflowModal: React.FC<CustomWorkflowModalProps> = ({
  isOpen,
  onClose,
  job,
  onSuccess
}) => {
  const { stages, isLoading } = useProductionStages();
  const [selectedStages, setSelectedStages] = useState<SelectedStage[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);

  const handleStageToggle = (stage: any, checked: boolean) => {
    if (checked) {
      const newStage: SelectedStage = {
        id: stage.id,
        name: stage.name,
        color: stage.color,
        order: selectedStages.length + 1
      };
      setSelectedStages(prev => [...prev, newStage]);
    } else {
      setSelectedStages(prev => {
        const filtered = prev.filter(s => s.id !== stage.id);
        // Reorder remaining stages
        return filtered.map((s, index) => ({ ...s, order: index + 1 }));
      });
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(selectedStages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order numbers
    const reorderedStages = items.map((stage, index) => ({
      ...stage,
      order: index + 1
    }));

    setSelectedStages(reorderedStages);
  };

  const handleRemoveStage = (stageId: string) => {
    setSelectedStages(prev => {
      const filtered = prev.filter(s => s.id !== stageId);
      return filtered.map((s, index) => ({ ...s, order: index + 1 }));
    });
  };

  const handleInitializeCustomWorkflow = async () => {
    if (selectedStages.length === 0) {
      toast.error("Please select at least one production stage");
      return;
    }

    if (!job || !job.id) {
      toast.error("Job information is missing");
      return;
    }

    setIsInitializing(true);
    try {
      console.log('🔄 Initializing custom workflow...', { 
        jobId: job.id, 
        selectedStages: selectedStages.length 
      });

      // First, check if the job already has workflow stages
      const { data: existingStages, error: checkError } = await supabase
        .from('job_stage_instances')
        .select('id')
        .eq('job_id', job.id)
        .eq('job_table_name', 'production_jobs');

      if (checkError) {
        console.error('❌ Error checking existing stages:', checkError);
        throw checkError;
      }

      if (existingStages && existingStages.length > 0) {
        toast.error("This job already has workflow stages. Please delete existing stages first.");
        return;
      }

      const stageIds = selectedStages.map(s => s.id);
      const stageOrders = selectedStages.map(s => s.order);

      console.log('🔄 Calling initialize_custom_job_stages with:', {
        p_job_id: job.id,
        p_job_table_name: 'production_jobs',
        p_stage_ids: stageIds,
        p_stage_orders: stageOrders
      });

      const { data, error } = await supabase.rpc('initialize_custom_job_stages', {
        p_job_id: job.id,
        p_job_table_name: 'production_jobs',
        p_stage_ids: stageIds,
        p_stage_orders: stageOrders
      });

      if (error) {
        console.error('❌ Custom workflow initialization error:', error);
        throw error;
      }

      console.log('✅ Custom workflow initialized successfully', data);
      toast.success("Custom workflow initialized successfully");
      onSuccess();
      onClose();
    } catch (err) {
      console.error('❌ Error initializing custom workflow:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize custom workflow";
      toast.error(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  const isStageSelected = (stageId: string) => {
    return selectedStages.some(s => s.id === stageId);
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">Loading stages...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Custom Workflow</DialogTitle>
          <DialogDescription>
            Select and order production stages for job {job?.wo_no || 'Unknown'}. This job will bypass category templates and use your custom workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Available Stages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Stages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stages?.map(stage => (
                <div key={stage.id} className="flex items-center space-x-3 p-2 border rounded">
                  <Checkbox
                    checked={isStageSelected(stage.id)}
                    onCheckedChange={(checked) => handleStageToggle(stage, checked as boolean)}
                  />
                  <Badge 
                    variant="outline" 
                    style={{ 
                      backgroundColor: `${stage.color}20`, 
                      color: stage.color, 
                      borderColor: `${stage.color}40` 
                    }}
                  >
                    {stage.name}
                  </Badge>
                  {stage.description && (
                    <span className="text-sm text-gray-500">{stage.description}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Selected Stages Order */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Workflow Order ({selectedStages.length} stages)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedStages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Plus className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>Select stages to build your workflow</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="selected-stages">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {selectedStages.map((stage, index) => (
                          <Draggable key={stage.id} draggableId={stage.id} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="flex items-center space-x-3 p-3 border rounded bg-white"
                              >
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="h-4 w-4 text-gray-400" />
                                </div>
                                <div className="flex-1 flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-500">
                                    {stage.order}.
                                  </span>
                                  <Badge 
                                    variant="outline"
                                    style={{ 
                                      backgroundColor: `${stage.color}20`, 
                                      color: stage.color, 
                                      borderColor: `${stage.color}40` 
                                    }}
                                  >
                                    {stage.name}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveStage(stage.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isInitializing}>
            Cancel
          </Button>
          <Button 
            onClick={handleInitializeCustomWorkflow}
            disabled={selectedStages.length === 0 || isInitializing}
            className="bg-green-600 hover:bg-green-700"
          >
            {isInitializing ? "Initializing..." : "Initialize Custom Workflow"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
