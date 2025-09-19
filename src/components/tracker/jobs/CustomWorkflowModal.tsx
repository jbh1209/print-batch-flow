import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, X, Calendar, Settings } from "lucide-react";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StageInstanceEditModal } from "./StageInstanceEditModal";
import { useSequentialScheduler } from "@/hooks/useSequentialScheduler";
import { useScheduleInvalidation } from "@/hooks/tracker/useScheduleInvalidation";

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
  // Stage instance configuration data
  quantity?: number | null;
  estimatedDurationMinutes?: number | null;
  partAssignment?: 'cover' | 'text' | 'both' | null;
  stageSpecificationId?: string | null;
}

export const CustomWorkflowModal: React.FC<CustomWorkflowModalProps> = ({
  isOpen,
  onClose,
  job,
  onSuccess
}) => {
  const { stages, isLoading } = useProductionStages();
  const { rescheduleJobs, isLoading: isRescheduling } = useSequentialScheduler();
  const { 
    invalidateJobSchedule, 
    detectScheduleImpact, 
    getEstimatedImpact,
    pendingInvalidations,
    isInvalidating
  } = useScheduleInvalidation();
  const [selectedStages, setSelectedStages] = useState<SelectedStage[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [hasExistingWorkflow, setHasExistingWorkflow] = useState(false);
  const [workflowType, setWorkflowType] = useState<'custom' | 'category' | 'blank'>('blank');
  const [manualDueDate, setManualDueDate] = useState<string>('');
  const [manualSlaDays, setManualSlaDays] = useState<number>(3);
  
  // Stage configuration modal
  const [editingStage, setEditingStage] = useState<SelectedStage | null>(null);
  const [stageConfigurations, setStageConfigurations] = useState<Record<string, any>>({});
  
  // Schedule management state
  const [scheduleImpact, setScheduleImpact] = useState<{
    hasScheduledSlots: boolean;
    affectedStages: number;
  } | null>(null);
  const [showScheduleControls, setShowScheduleControls] = useState(false);

  // Load existing workflow stages or category template when modal opens
  useEffect(() => {
    if (isOpen && job?.id) {
      loadWorkflowData();
      checkScheduleImpact();
    }
  }, [isOpen, job?.id]);

  const checkScheduleImpact = async () => {
    if (!job?.id) return;
    
    try {
      const impact = await detectScheduleImpact(job.id);
      setScheduleImpact(impact);
      setShowScheduleControls(impact.hasScheduledSlots);
    } catch (error) {
      console.error('Error checking schedule impact:', error);
    }
  };

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
          quantity,
          estimated_duration_minutes,
          part_assignment,
          stage_specification_id,
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
          order: stage.stage_order,
          // Load existing configuration data if available
          quantity: (stage as any).quantity || null,
          estimatedDurationMinutes: (stage as any).estimated_duration_minutes || null,
          partAssignment: (stage as any).part_assignment || null,
          stageSpecificationId: (stage as any).stage_specification_id || null
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
          order: stage.stage_order,
          // Initialize with default values for new stages
          quantity: job?.qty || null,
          estimatedDurationMinutes: null,
          partAssignment: null,
          stageSpecificationId: null
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
        order: selectedStages.length + 1,
        // Initialize with job quantity as default
        quantity: job?.qty || null,
        estimatedDurationMinutes: null,
        partAssignment: null,
        stageSpecificationId: null
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

  const handleConfigureStage = (stage: SelectedStage) => {
    console.log('🔧 Opening configuration for stage:', stage);
    setEditingStage(stage);
  };

  const handleSaveStageConfiguration = (updatedConfig: any) => {
    if (!editingStage) return;
    
    console.log('💾 Saving stage configuration:', updatedConfig);
    
    // Update the stage in selectedStages
    setSelectedStages(prev => prev.map(stage => 
      stage.id === editingStage.id 
        ? { 
            ...stage, 
            quantity: updatedConfig.quantity,
            estimatedDurationMinutes: updatedConfig.estimatedDurationMinutes,
            partAssignment: updatedConfig.partAssignment,
            stageSpecificationId: updatedConfig.stageSpecificationId
          }
        : stage
    ));
    
    // Store configuration for later database update
    setStageConfigurations(prev => ({
      ...prev,
      [editingStage.id]: updatedConfig
    }));
    
    setEditingStage(null);
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

      // Check if we need to invalidate existing schedule
      if (scheduleImpact?.hasScheduledSlots) {
        console.log('📅 Invalidating existing schedule due to workflow changes...');
        await invalidateJobSchedule(job.id, { autoReschedule: false });
      }

      if (hasExistingWorkflow) {
        // SURGICAL UPDATE: Preserve existing stage metadata, only update what changed
        console.log('🔧 Surgically updating existing workflow...');
        await updateExistingWorkflow();
      } else {
        // CREATE NEW: First time custom workflow
        console.log('🔄 Creating new custom workflow...');
        await createNewWorkflow();
      }

      // Update the job with custom workflow flag and manual SLA data
      // FIXED: Preserve category_id - don't set to null as it corrupts job metadata
      const updateData: any = {
        has_custom_workflow: true,
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
      
      // Refresh schedule impact after changes
      await checkScheduleImpact();
      
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

  const updateExistingWorkflow = async () => {
    // Get current job stage instances with full metadata
    const { data: currentStages, error: fetchError } = await supabase
      .from('job_stage_instances')
      .select('*')
      .eq('job_id', job.id)
      .eq('job_table_name', 'production_jobs')
      .order('stage_order');

    if (fetchError) {
      console.error('❌ Error fetching existing stages:', fetchError);
      throw fetchError;
    }

    console.log('📋 Current stages:', currentStages?.length || 0);
    console.log('🎯 Target stages:', selectedStages.length);

    // Create maps for efficient lookup
    const currentStageMap = new Map(currentStages?.map(s => [s.production_stage_id, s]) || []);
    const selectedStageMap = new Map(selectedStages.map(s => [s.id, s]));

    // Track what we need to do
    const stagesToUpdate: Array<{current: any, target: SelectedStage}> = [];
    const stagesToInsert: SelectedStage[] = [];
    const stagesToDelete: any[] = [];

    // Analyze changes needed
    selectedStages.forEach(targetStage => {
      const currentStage = currentStageMap.get(targetStage.id);
      if (currentStage) {
        // Stage exists - check if it needs updating
        if (currentStage.stage_order !== targetStage.order) {
          stagesToUpdate.push({ current: currentStage, target: targetStage });
        }
      } else {
        // New stage - needs inserting
        stagesToInsert.push(targetStage);
      }
    });

    // Find stages to remove (only if they're still pending)
    currentStages?.forEach(currentStage => {
      if (!selectedStageMap.has(currentStage.production_stage_id)) {
        if (currentStage.status === 'pending') {
          stagesToDelete.push(currentStage);
        } else {
          console.warn(`⚠️ Cannot remove ${currentStage.status} stage:`, currentStage.production_stage_id);
          toast.warning(`Cannot remove ${currentStage.status} stage. Skipping removal.`);
        }
      }
    });

    console.log(`🔄 Changes needed: ${stagesToUpdate.length} updates, ${stagesToInsert.length} inserts, ${stagesToDelete.length} deletes`);

    // Apply updates (preserve all metadata, only change stage_order)
    for (const { current, target } of stagesToUpdate) {
      console.log(`📝 Updating stage order: ${current.production_stage_id} from ${current.stage_order} to ${target.order}`);
      
      const { error: updateError } = await supabase
        .from('job_stage_instances')
        .update({ 
          stage_order: target.order,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id);

      if (updateError) {
        console.error('❌ Error updating stage:', updateError);
        throw updateError;
      }
    }

    // Insert new stages with safe defaults and configuration data
    for (const stage of stagesToInsert) {
      console.log(`➕ Inserting new stage: ${stage.name} at order ${stage.order}`);
      
      const { error: insertError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: job.id,
          job_table_name: 'production_jobs',
          production_stage_id: stage.id,
          stage_order: stage.order,
          status: 'pending',
          started_at: null,
          started_by: null,
          // Include stage configuration data
          quantity: stage.quantity || job?.qty || null,
          estimated_duration_minutes: stage.estimatedDurationMinutes || null,
          part_assignment: stage.partAssignment || null,
          stage_specification_id: stage.stageSpecificationId || null
        });

      if (insertError) {
        console.error(`❌ Error inserting stage ${stage.name}:`, insertError);
        throw insertError;
      }
    }

    // Delete removed stages (only pending ones)
    for (const stage of stagesToDelete) {
      console.log(`🗑️ Removing pending stage: ${stage.production_stage_id}`);
      
      const { error: deleteError } = await supabase
        .from('job_stage_instances')
        .delete()
        .eq('id', stage.id);

      if (deleteError) {
        console.error('❌ Error deleting stage:', deleteError);
        throw deleteError;
      }
    }

    // Update the job metadata
    await updateJobMetadata();
  };

  const createNewWorkflow = async () => {
    // Create all new stage instances - ALL START AS PENDING
    console.log('🔄 Creating new stage instances (ALL PENDING)...');
    
    for (let i = 0; i < selectedStages.length; i++) {
      const stage = selectedStages[i];
      
      console.log(`Creating stage ${i + 1} as PENDING:`, stage);
      
      const { error: insertError } = await supabase
        .from('job_stage_instances')
        .insert({
          job_id: job.id,
          job_table_name: 'production_jobs',
          production_stage_id: stage.id,
          stage_order: stage.order,
          status: 'pending',
          started_at: null,
          started_by: null,
          // Include stage configuration data with defaults
          quantity: stage.quantity || job?.qty || null,
          estimated_duration_minutes: stage.estimatedDurationMinutes || null,
          part_assignment: stage.partAssignment || null,
          stage_specification_id: stage.stageSpecificationId || null
        });

      if (insertError) {
        console.error(`❌ Error inserting stage ${stage.name}:`, insertError);
        throw insertError;
      }
    }

    // Update the job metadata
    await updateJobMetadata();
  };

  const updateJobMetadata = async () => {
    // Update the job with custom workflow flag and manual SLA data
    // FIXED: Preserve category_id - don't set to null as it corrupts job metadata
    const updateData: any = {
      has_custom_workflow: true,
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
  };

  const isStageSelected = (stageId: string) => {
    return selectedStages.some(s => s.id === stageId);
  };

  const getStageConfigurationStatus = (stage: SelectedStage) => {
    const hasQuantity = stage.quantity && stage.quantity > 0;
    const hasDuration = stage.estimatedDurationMinutes && stage.estimatedDurationMinutes > 0;
    const hasSpec = stage.stageSpecificationId;
    
    let configured = 0;
    let total = 3;
    
    if (hasQuantity) configured++;
    if (hasDuration) configured++;
    if (hasSpec) configured++;
    
    return { configured, total, hasQuantity, hasDuration, hasSpec };
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
                                  
                                  {/* Configuration status indicators */}
                                  <div className="flex items-center gap-1">
                                    {(() => {
                                      const config = getStageConfigurationStatus(stage);
                                      return (
                                        <>
                                          {config.hasQuantity && (
                                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                              Qty: {stage.quantity}
                                            </Badge>
                                          )}
                                          {config.hasDuration && (
                                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                              {stage.estimatedDurationMinutes}min
                                            </Badge>
                                          )}
                                          {!config.hasQuantity && (
                                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                                              No Qty
                                            </Badge>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleConfigureStage(stage)}
                                    className="h-8 w-8 p-0"
                                    title="Configure stage details"
                                  >
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveStage(stage.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
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

        <DialogFooter className="flex-col space-y-3">
          {/* Schedule Management Controls */}
          {showScheduleControls && scheduleImpact && (
            <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">
                    Schedule Impact: {scheduleImpact.affectedStages} stages scheduled
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!job?.id) return;
                      try {
                        await invalidateJobSchedule(job.id, { autoReschedule: false });
                        await checkScheduleImpact();
                        toast.success('Schedule cleared successfully');
                      } catch (error) {
                        console.error('Error invalidating schedule:', error);
                        toast.error('Failed to clear schedule');
                      }
                    }}
                    disabled={isInvalidating}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Clear Schedule
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!job?.id) return;
                      try {
                        await rescheduleJobs([job.id]);
                        await checkScheduleImpact();
                        toast.success('Job rescheduled successfully');
                      } catch (error) {
                        console.error('Error rescheduling job:', error);
                        toast.error('Failed to reschedule job');
                      }
                    }}
                    disabled={isRescheduling}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    {isRescheduling ? 'Rescheduling...' : 'Reschedule Job'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-amber-700">
                Workflow changes may require schedule updates. Use "Reschedule Job" after making changes.
              </p>
            </div>
          )}
          
          {/* Main Action Buttons */}
          <div className="flex justify-end space-x-2 w-full">
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
          </div>
        </DialogFooter>
      </DialogContent>
      
      {/* Stage Configuration Modal */}
      {editingStage && (
        <StageInstanceEditModal
          isOpen={!!editingStage}
          onClose={() => setEditingStage(null)}
          jobData={{
            id: job?.id || '',
            wo_no: job?.wo_no || '',
            qty: job?.qty || 1
          }}
          stageData={{
            stageId: editingStage.id,
            stageName: editingStage.name,
            stageColor: editingStage.color,
            quantity: editingStage.quantity || null,
            estimatedDurationMinutes: editingStage.estimatedDurationMinutes || null,
            partAssignment: editingStage.partAssignment || null,
            stageSpecificationId: editingStage.stageSpecificationId || null
          }}
          onSave={handleSaveStageConfiguration}
        />
      )}
    </Dialog>
  );
};
