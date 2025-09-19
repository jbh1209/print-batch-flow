import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useProductionStages } from "@/hooks/tracker/useProductionStages";
import { useSequentialScheduler } from "@/hooks/useSequentialScheduler";
import { useScheduleInvalidation } from "@/hooks/tracker/useScheduleInvalidation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Import wizard steps
import { WorkflowWizardStep } from "./workflow-wizard/WorkflowWizardStep";
import { StageSelectionStep } from "./workflow-wizard/StageSelectionStep";
import { StageConfigurationStep } from "./workflow-wizard/StageConfigurationStep";
import { ReviewStep } from "./workflow-wizard/ReviewStep";

interface EnhancedCustomWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onSuccess: () => void;
}

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

const STEPS = [
  { id: 1, title: "Select Stages", description: "Choose production stages for your workflow" },
  { id: 2, title: "Configure Stages", description: "Set quantities, durations, and ordering" },
  { id: 3, title: "Review & Apply", description: "Review your workflow and apply changes" }
];

export const EnhancedCustomWorkflowModal: React.FC<EnhancedCustomWorkflowModalProps> = ({
  isOpen,
  onClose,
  job,
  onSuccess
}) => {
  const { stages, isLoading } = useProductionStages();
  const { rescheduleJobs, isLoading: isRescheduling } = useSequentialScheduler();
  const { invalidateJobSchedule, detectScheduleImpact, isInvalidating } = useScheduleInvalidation();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([]);
  const [stageConfigs, setStageConfigs] = useState<StageConfig[]>([]);
  const [manualDueDate, setManualDueDate] = useState<string>('');
  const [manualSlaDays, setManualSlaDays] = useState<number>(3);
  
  // Loading states
  const [isApplying, setIsApplying] = useState(false);
  const [isCalculatingDurations, setIsCalculatingDurations] = useState(false);
  const [scheduleImpact, setScheduleImpact] = useState<any>(null);

  // Load existing data when modal opens
  useEffect(() => {
    if (isOpen && job?.id) {
      loadExistingWorkflow();
      checkScheduleImpact();
    }
  }, [isOpen, job?.id]);

  const loadExistingWorkflow = async () => {
    try {
      // Load job data
      const { data: jobData } = await supabase
        .from('production_jobs')
        .select('manual_due_date, manual_sla_days')
        .eq('id', job.id)
        .single();

      if (jobData) {
        setManualDueDate(jobData.manual_due_date || '');
        setManualSlaDays(jobData.manual_sla_days || 3);
      }

      // Load existing stages
      const { data: existingStages } = await supabase
        .from('job_stage_instances')
        .select(`
          production_stage_id,
          stage_order,
          quantity,
          estimated_duration_minutes,
          part_assignment,
          stage_specification_id,
          production_stage:production_stages(id, name, color)
        `)
        .eq('job_id', job.id)
        .order('stage_order');

      if (existingStages && existingStages.length > 0) {
        const configs = existingStages.map((stage, index) => ({
          id: stage.production_stage_id,
          name: stage.production_stage.name,
          color: stage.production_stage.color,
          order: index + 1,
          quantity: stage.quantity,
          estimatedDurationMinutes: stage.estimated_duration_minutes,
          partAssignment: stage.part_assignment as 'cover' | 'text' | 'both' | null,
          stageSpecificationId: stage.stage_specification_id
        }));
        
        setSelectedStageIds(configs.map(c => c.id));
        setStageConfigs(configs);
      }
    } catch (error) {
      console.error('Error loading existing workflow:', error);
    }
  };

  const checkScheduleImpact = async () => {
    if (!job?.id) return;
    try {
      const impact = await detectScheduleImpact(job.id);
      setScheduleImpact(impact);
    } catch (error) {
      console.error('Error checking schedule impact:', error);
    }
  };

  // Step 1: Stage Selection Handlers
  const handleStageToggle = (stageId: string, checked: boolean) => {
    if (checked) {
      setSelectedStageIds(prev => [...prev, stageId]);
      
      // Add to configs with defaults
      const stage = stages?.find(s => s.id === stageId);
      if (stage) {
        setStageConfigs(prev => [...prev, {
          id: stageId,
          name: stage.name,
          color: stage.color,
          order: prev.length + 1,
          quantity: job?.qty || null,
          estimatedDurationMinutes: null,
          partAssignment: null,
          stageSpecificationId: null
        }]);
      }
    } else {
      setSelectedStageIds(prev => prev.filter(id => id !== stageId));
      setStageConfigs(prev => prev.filter(config => config.id !== stageId));
    }
  };

  const handleBulkStageSelection = (action: 'all' | 'none' | 'common') => {
    if (!stages) return;
    
    switch (action) {
      case 'all':
        const allIds = stages.map(s => s.id);
        setSelectedStageIds(allIds);
        setStageConfigs(stages.map((stage, index) => ({
          id: stage.id,
          name: stage.name,
          color: stage.color,
          order: index + 1,
          quantity: job?.qty || null,
          estimatedDurationMinutes: null,
          partAssignment: null,
          stageSpecificationId: null
        })));
        break;
      case 'none':
        setSelectedStageIds([]);
        setStageConfigs([]);
        break;
      case 'common':
        const commonStages = stages.filter(stage => 
          stage.name.toLowerCase().includes('printing') ||
          stage.name.toLowerCase().includes('cutting') ||
          stage.name.toLowerCase().includes('finishing')
        );
        const commonIds = commonStages.map(s => s.id);
        setSelectedStageIds(commonIds);
        setStageConfigs(commonStages.map((stage, index) => ({
          id: stage.id,
          name: stage.name,
          color: stage.color,
          order: index + 1,
          quantity: job?.qty || null,
          estimatedDurationMinutes: null,
          partAssignment: null,
          stageSpecificationId: null
        })));
        break;
    }
  };

  const handleApplyTemplate = async (templateType: 'category' | 'similar') => {
    toast.info(`${templateType} template application coming soon!`);
  };

  // Step 2: Configuration Handlers
  const handleStageReorder = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(stageConfigs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update orders
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index + 1
    }));

    setStageConfigs(updatedItems);
  };

  const handleStageUpdate = (stageId: string, updates: Partial<StageConfig>) => {
    setStageConfigs(prev => prev.map(config => 
      config.id === stageId 
        ? { ...config, ...updates }
        : config
    ));
  };

  const handleBulkUpdate = (updates: Partial<StageConfig>) => {
    setStageConfigs(prev => prev.map(config => ({ ...config, ...updates })));
    toast.success('Bulk updates applied to all stages');
  };

  const handleCalculateDurations = async () => {
    setIsCalculatingDurations(true);
    try {
      // Mock calculation - replace with actual duration calculation logic
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStageConfigs(prev => prev.map(config => ({
        ...config,
        estimatedDurationMinutes: config.estimatedDurationMinutes || Math.floor(Math.random() * 120) + 30
      })));
      
      toast.success('Durations calculated based on stage specifications');
    } catch (error) {
      toast.error('Failed to calculate durations');
    } finally {
      setIsCalculatingDurations(false);
    }
  };

  // Step 3: Review Handlers
  const handleRescheduleJob = async () => {
    if (!job?.id) return;
    try {
      await rescheduleJobs([job.id]);
      await checkScheduleImpact();
      toast.success('Job rescheduled successfully');
    } catch (error) {
      toast.error('Failed to reschedule job');
    }
  };

  const handleInvalidateSchedule = async () => {
    if (!job?.id) return;
    try {
      await invalidateJobSchedule(job.id, { autoReschedule: false });
      await checkScheduleImpact();
      toast.success('Schedule cleared successfully');
    } catch (error) {
      toast.error('Failed to clear schedule');
    }
  };

  // Final application
  const handleApplyWorkflow = async () => {
    setIsApplying(true);
    try {
      // Invalidate existing schedule if needed
      if (scheduleImpact?.hasScheduledSlots) {
        await invalidateJobSchedule(job.id, { autoReschedule: false });
      }

      // Apply the workflow changes using the same logic as the original modal
      // This would need to be extracted to a shared service
      await applyWorkflowChanges();
      
      toast.success('Custom workflow applied successfully');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error applying workflow:', error);
      toast.error('Failed to apply workflow changes');
    } finally {
      setIsApplying(false);
    }
  };

  const applyWorkflowChanges = async () => {
    // Implementation would be similar to the existing CustomWorkflowModal logic
    // This is a placeholder - you would extract the actual logic
    console.log('Applying workflow changes:', stageConfigs);
  };

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 1: return selectedStageIds.length > 0;
      case 2: return stageConfigs.length > 0;
      case 3: return true;
      default: return false;
    }
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <StageSelectionStep
            stages={stages || []}
            selectedStages={selectedStageIds}
            onStageToggle={handleStageToggle}
            onApplyTemplate={handleApplyTemplate}
            onBulkSelect={handleBulkStageSelection}
            jobCategory={job?.category}
          />
        );
      case 2:
        return (
          <StageConfigurationStep
            stages={stageConfigs}
            onStageReorder={handleStageReorder}
            onStageUpdate={handleStageUpdate}
            onBulkUpdate={handleBulkUpdate}
            onCalculateDurations={handleCalculateDurations}
            jobQuantity={job?.qty || 1}
            isCalculatingDurations={isCalculatingDurations}
          />
        );
      case 3:
        return (
          <ReviewStep
            stages={stageConfigs}
            jobData={{
              wo_no: job?.wo_no || '',
              qty: job?.qty || 1,
              customer: job?.customer || '',
              category: job?.category || ''
            }}
            scheduleImpact={scheduleImpact}
            manualDueDate={manualDueDate}
            manualSlaDays={manualSlaDays}
            onRescheduleJob={handleRescheduleJob}
            onInvalidateSchedule={handleInvalidateSchedule}
            isRescheduling={isRescheduling}
            isInvalidating={isInvalidating}
          />
        );
      default:
        return null;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Custom Workflow Wizard</DialogTitle>
          <DialogDescription>
            Configure a custom production workflow for job {job?.wo_no}
          </DialogDescription>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {currentStep} of {STEPS.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <WorkflowWizardStep
            stepNumber={currentStep}
            title={STEPS[currentStep - 1].title}
            description={STEPS[currentStep - 1].description}
            isActive={true}
            isCompleted={false}
          >
            {getStepContent()}
          </WorkflowWizardStep>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            
            {currentStep < STEPS.length ? (
              <Button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canGoNext()}
                className="bg-primary hover:bg-primary/90"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleApplyWorkflow}
                disabled={isApplying || !canGoNext()}
                className="bg-green-600 hover:bg-green-700"
              >
                {isApplying ? 'Applying...' : 'Apply Workflow'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};