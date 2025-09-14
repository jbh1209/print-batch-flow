import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, X, Calendar } from "lucide-react";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TimingCalculationService } from "@/services/timingCalculationService";

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
  const [workflowType, setWorkflowType] = useState<'custom' | 'category' | 'blank'>('blank');
  const [manualDueDate, setManualDueDate] = useState<string>('');
  const [manualSlaDays, setManualSlaDays] = useState<number>(3);

  // Load existing workflow stages or category template when modal opens
  useEffect(() => {
    if (isOpen && job?.id) {
      loadWorkflowData();
    }
  }, [isOpen, job?.id]);

  const loadWorkflowData = async () => {
    setIsLoadingExisting(true);
    try {
      console.log('🔄 Loading workflow data for job:', job.id);

      // Load existing manual due date and SLA if available
      const { data: jobData, error: jobError } = await supabase
        .from('production_jobs')
        .select('manual_due_date, manual_sla_days')
        .eq('id', job.id)
        .single();

      if (jobError) {
        console.error('❌ Error loading job data:', jobError);
      } else if (jobData) {
        if (jobData.manual_due_date) {
          setManualDueDate(jobData.manual_due_date);
        }
        if (jobData.manual_sla_days) {
          setManualSlaDays(jobData.manual_sla_days);
        }
      }

      // First, check for existing stage instances
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
        // Existing custom workflow found
        console.log('✅ Found existing stages:', existingStages.length);
        setHasExistingWorkflow(true);
        setWorkflowType('custom');
        
        const mappedStages: SelectedStage[] = existingStages.map(stage => ({
          id: stage.production_stage.id,
          name: stage.production_stage.name,
          color: stage.production_stage.color,
          order: stage.stage_order
        }));
        
        setSelectedStages(mappedStages);
      } else if (job.category_id) {
        // No existing stages but has category - load category template
        console.log('📋 Loading category template for category:', job.category_id);
        await loadCategoryTemplate(job.category_id);
      } else {
        // No existing stages and no category - blank workflow
        console.log('📝 Starting with blank workflow');
        setHasExistingWorkflow(false);
        setWorkflowType('blank');
        setSelectedStages([]);
      }
    } catch (err) {
      console.error('❌ Error loading workflow data:', err);
      toast.error("Failed to load workflow data");
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const loadCategoryTemplate = async (categoryId: string) => {
    try {
      const { data: categoryStages, error } = await supabase
        .from('category_production_stages')
        .select(`
          stage_order,
          production_stage:production_stages(
            id,
            name,
            color
          )
        `)
        .eq('category_id', categoryId)
        .order('stage_order');

      if (error) throw error;

      if (categoryStages && categoryStages.length > 0) {
        console.log('✅ Loaded category template stages:', categoryStages.length);
        setHasExistingWorkflow(false);
        setWorkflowType('category');
        
        const mappedStages: SelectedStage[] = categoryStages.map(stage => ({
          id: stage.production_stage.id,
          name: stage.production_stage.name,
          color: stage.production_stage.color,
          order: stage.stage_order
        }));
        
        setSelectedStages(mappedStages);
      } else {
        // Category has no stages defined - fall back to blank
        setWorkflowType('blank');
        setSelectedStages([]);
      }
    } catch (err) {
      console.error('❌ Error loading category template:', err);
      setWorkflowType('blank');
      setSelectedStages([]);
    }
  };

  const getModalTitle = () => {
    switch (workflowType) {
      case 'custom':
        return 'Edit Custom Workflow';
      case 'category':
        return 'Customize Category Template';
      case 'blank':
      default:
        return 'Create Custom Workflow';
    }
  };

  const getModalDescription = () => {
    switch (workflowType) {
      case 'custom':
        return 'You can modify the existing custom workflow below.';
      case 'category':
        return 'Starting with your category template. Modify as needed to create a custom workflow.';
      case 'blank':
      default:
        return 'This job will bypass category templates and use your custom workflow.';
    }
  };

  const getButtonText = () => {
    if (isInitializing) {
      return hasExistingWorkflow ? "Updating..." : "Initializing...";
    }
    return hasExistingWorkflow ? "Update Custom Workflow" : "Initialize Custom Workflow";
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

  const calculateDueDateFromSLA = () => {
    if (manualSlaDays > 0) {
      const today = new Date();
      const dueDate = new Date(today);
      dueDate.setDate(today.getDate() + manualSlaDays);
      setManualDueDate(dueDate.toISOString().split('T')[0]);
    }
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
        hasExistingWorkflow,
        workflowType,
        manualDueDate,
        manualSlaDays
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

      // Create new stage instances - ALL START AS PENDING
      console.log('🔄 Creating new stage instances (ALL PENDING)...');
      
      const createdStageIds: string[] = [];
      
      for (let i = 0; i < selectedStages.length; i++) {
        const stage = selectedStages[i];
        
        console.log(`Creating stage ${i + 1} as PENDING:`, stage);
        
        const { data: insertedStage, error: insertError } = await supabase
          .from('job_stage_instances')
          .insert({
            job_id: job.id,
            job_table_name: 'production_jobs',
            production_stage_id: stage.id,
            stage_order: stage.order,
            status: 'pending', // CRITICAL FIX: All stages start as pending
            started_at: null,   // CRITICAL FIX: No auto-start
            started_by: null    // CRITICAL FIX: No auto-assignment
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`❌ Error inserting stage ${stage.name}:`, insertError);
          throw insertError;
        }
        
        if (insertedStage) {
          createdStageIds.push(insertedStage.id);
        }
      }

      // Now update quantities and calculate timing for all created stages
      console.log('🔄 Calculating timing and setting quantities...');
      
      for (let i = 0; i < createdStageIds.length; i++) {
        const stageInstanceId = createdStageIds[i];
        const stage = selectedStages[i];
        
        try {
          // Calculate timing using the service
          const timing = await TimingCalculationService.calculateStageTimingWithInheritance({
            quantity: job.qty || 1,
            stageId: stage.id,
            specificationId: null,
            stageData: null,
            specificationData: null
          });

          // Update the stage instance with quantity and timing
          const { error: updateError } = await supabase
            .from('job_stage_instances')
            .update({
              quantity: job.qty || 1,
              estimated_duration_minutes: timing.estimatedDurationMinutes,
              setup_time_minutes: timing.makeReadyMinutes || 0
            })
            .eq('id', stageInstanceId);

          if (updateError) {
            console.error(`❌ Error updating stage timing for ${stage.name}:`, updateError);
            // Don't throw here - continue with other stages
          } else {
            console.log(`✅ Updated timing for ${stage.name}: ${timing.estimatedDurationMinutes}min`);
          }
        } catch (timingError) {
          console.error(`⚠️ Failed to calculate timing for ${stage.name}:`, timingError);
          // Fallback: just set quantity without timing
          const { error: fallbackError } = await supabase
            .from('job_stage_instances')
            .update({
              quantity: job.qty || 1,
              estimated_duration_minutes: 60, // Default 1 hour
              setup_time_minutes: 10 // Default 10 minutes
            })
            .eq('id', stageInstanceId);

          if (fallbackError) {
            console.error(`❌ Fallback update failed for ${stage.name}:`, fallbackError);
          }
        }
      }

      // Update the job with custom workflow flag and manual SLA data
      const updateData: any = {
        has_custom_workflow: true,
        category_id: null, // Set to null instead of 'custom'
        updated_at: new Date().toISOString()
      };

      // FIXED: Always include manual_due_date and manual_sla_days in the update
      // This ensures that clearing dates actually persists to the database
      updateData.manual_due_date = manualDueDate || null;
      updateData.manual_sla_days = manualSlaDays > 0 ? manualSlaDays : null;

      const { error: updateError } = await supabase
        .from('production_jobs')
        .update(updateData)
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {getModalTitle()}
          </DialogTitle>
          <DialogDescription>
            Select and order production stages for job {job?.wo_no || 'Unknown'}. 
            {getModalDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Manual SLA Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Manual SLA Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sla-days">SLA Target Days</Label>
                <div className="flex gap-2">
                  <Input
                    id="sla-days"
                    type="number"
                    min="1"
                    max="30"
                    value={manualSlaDays}
                    onChange={(e) => setManualSlaDays(Number(e.target.value))}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={calculateDueDateFromSLA}
                  >
                    Calculate
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="due-date">Manual Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={manualDueDate}
                  onChange={(e) => setManualDueDate(e.target.value)}
                />
              </div>

              <div className="text-sm text-gray-600">
                <p className="font-medium">Note:</p>
                <p>Custom workflows require manual due date management since they don't inherit category SLA settings.</p>
              </div>
            </CardContent>
          </Card>

          {/* Available Stages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Stages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-96 overflow-y-auto">
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
            <CardContent className="max-h-96 overflow-y-auto">
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
            {getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
