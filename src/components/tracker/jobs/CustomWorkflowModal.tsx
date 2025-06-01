
import React, { useState, useEffect } from "react";
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
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [hasExistingWorkflow, setHasExistingWorkflow] = useState(false);

  // Load existing workflow stages when modal opens
  useEffect(() => {
    if (isOpen && job?.id) {
      loadExistingWorkflow();
    }
  }, [isOpen, job?.id]);

  const loadExistingWorkflow = async () => {
    setIsLoadingExisting(true);
    try {
      console.log('🔄 Loading existing workflow for job:', job.id);

      const { data: existingStages, error } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          stage_order,
          status,
          production_stage:production_stages(
            id,
            name,
            color
          )
        `)
        .eq('job_id', job.id)
        .eq('job_table_name', 'production_jobs')
        .order('stage_order');

      if (error) {
        console.error('❌ Error loading existing stages:', error);
        throw error;
      }

      if (existingStages && existingStages.length > 0) {
        console.log('✅ Found existing stages:', existingStages.length);
        setHasExistingWorkflow(true);
        
        const mappedStages: SelectedStage[] = existingStages.map(stage => ({
          id: stage.production_stage.id,
          name: stage.production_stage.name,
          color: stage.production_stage.color,
          order: stage.stage_order
        }));
        
        setSelectedStages(mappedStages);
      } else {
        console.log('ℹ️ No existing stages found');
        setHasExistingWorkflow(false);
        setSelectedStages([]);
      }
    } catch (err) {
      console.error('❌ Error loading existing workflow:', err);
      toast.error("Failed to load existing workflow");
    } finally {
      setIsLoadingExisting(false);
    }
  };

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
    // Safely handle drag result
    if (!result || !result.destination) {
      console.log('Drag cancelled or no destination');
      return;
    }

    console.log('Drag result:', result);

    const { source, destination } = result;
    
    // Return if dropped in the same position
    if (source.index === destination.index) {
      return;
    }

    try {
      // Create a copy of the current selected stages
      const items = Array.from(selectedStages);
      
      // Remove the dragged item from source position
      const [reorderedItem] = items.splice(source.index, 1);
      
      // Insert the item at the destination position
      items.splice(destination.index, 0, reorderedItem);

      // Update order numbers to reflect new positions
      const reorderedStages = items.map((stage, index) => ({
        ...stage,
        order: index + 1
      }));

      console.log('Reordered stages:', reorderedStages);
      setSelectedStages(reorderedStages);
    } catch (error) {
      console.error('Error during drag and drop:', error);
      toast.error("Error reordering stages");
    }
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
      console.log('🔄 Initializing/updating custom workflow...', { 
        jobId: job.id, 
        selectedStages: selectedStages.length,
        hasExistingWorkflow
      });

      // If there are existing stages, delete them first
      if (hasExistingWorkflow) {
        console.log('🗑️ Deleting existing stages...');
        const { error: deleteError } = await supabase
          .from('job_stage_instances')
          .delete()
          .eq('job_id', job.id)
          .eq('job_table_name', 'production_jobs');

        if (deleteError) {
          console.error('❌ Error deleting existing stages:', deleteError);
          throw deleteError;
        }
      }

      // Create new stage instances
      console.log('🔄 Creating new stage instances...');
      
      for (let i = 0; i < selectedStages.length; i++) {
        const stage = selectedStages[i];
        const isFirstStage = i === 0;
        
        console.log(`Creating stage ${i + 1}:`, stage);
        
        const { error: insertError } = await supabase
          .from('job_stage_instances')
          .insert({
            job_id: job.id,
            job_table_name: 'production_jobs',
            production_stage_id: stage.id,
            stage_order: stage.order,
            status: isFirstStage ? 'active' : 'pending',
            started_at: isFirstStage ? new Date().toISOString() : null,
            started_by: isFirstStage ? (await supabase.auth.getUser()).data.user?.id : null
          });

        if (insertError) {
          console.error(`❌ Error inserting stage ${stage.name}:`, insertError);
          throw insertError;
        }
      }

      // Mark the job as having a custom workflow - set category_id to null instead of 'custom'
      const { error: updateError } = await supabase
        .from('production_jobs')
        .update({ 
          has_custom_workflow: true,
          category_id: null, // Set to null instead of 'custom'
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      if (updateError) {
        console.error('❌ Error updating job:', updateError);
        throw updateError;
      }

      console.log('✅ Custom workflow initialized/updated successfully');
      toast.success(hasExistingWorkflow ? "Custom workflow updated successfully" : "Custom workflow initialized successfully");
      onSuccess();
      onClose();
    } catch (err) {
      console.error('❌ Error initializing/updating custom workflow:', err);
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize custom workflow";
      toast.error(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  const isStageSelected = (stageId: string) => {
    return selectedStages.some(s => s.id === stageId);
  };

  if (isLoading || isLoadingExisting) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loading Workflow</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="text-center">Loading...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {hasExistingWorkflow ? 'Edit Custom Workflow' : 'Create Custom Workflow'}
          </DialogTitle>
          <DialogDescription>
            Select and order production stages for job {job?.wo_no || 'Unknown'}. 
            {hasExistingWorkflow 
              ? 'You can modify the existing custom workflow below.' 
              : 'This job will bypass category templates and use your custom workflow.'
            }
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
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-2 min-h-[100px] ${
                          snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg' : ''
                        }`}
                      >
                        {selectedStages.map((stage, index) => (
                          <Draggable 
                            key={stage.id} 
                            draggableId={stage.id} 
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center space-x-3 p-3 border rounded bg-white transition-all ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2' : 'shadow-sm'
                                }`}
                                style={{
                                  ...provided.draggableProps.style,
                                }}
                              >
                                <div {...provided.dragHandleProps}>
                                  <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
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
            {isInitializing 
              ? (hasExistingWorkflow ? "Updating..." : "Initializing...") 
              : (hasExistingWorkflow ? "Update Custom Workflow" : "Initialize Custom Workflow")
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
