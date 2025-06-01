interface WorkflowStage {
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
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateWorkflow = (stages: WorkflowStage[]): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if workflow has stages
  if (stages.length === 0) {
    errors.push("Workflow must have at least one stage");
    return { isValid: false, errors, warnings };
  }

  // Check stage order consistency - more robust gap detection
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);
  for (let i = 0; i < sortedStages.length; i++) {
    const expectedOrder = i + 1;
    const actualOrder = sortedStages[i].stage_order;
    if (actualOrder !== expectedOrder) {
      errors.push(`Stage order gap detected. Expected ${expectedOrder}, found ${actualOrder}`);
    }
  }

  // Check for duplicate stages
  const stageIds = stages.map(s => s.production_stage.id);
  const uniqueStageIds = [...new Set(stageIds)];
  if (stageIds.length !== uniqueStageIds.length) {
    errors.push("Duplicate production stages found in workflow");
  }

  // Check duration bounds
  stages.forEach(stage => {
    if (stage.estimated_duration_hours < 1) {
      errors.push(`Stage "${stage.production_stage.name}" must have at least 1 hour duration`);
    }
    if (stage.estimated_duration_hours > 168) {
      warnings.push(`Stage "${stage.production_stage.name}" has unusually long duration (${stage.estimated_duration_hours}h)`);
    }
  });

  // Check workflow length
  if (stages.length > 10) {
    warnings.push(`Workflow has ${stages.length} stages, which may be complex to manage`);
  }

  // Check total duration
  const totalHours = stages.reduce((sum, stage) => sum + stage.estimated_duration_hours, 0);
  if (totalHours > 240) { // 30 working days
    warnings.push(`Total workflow duration is ${totalHours} hours (${Math.ceil(totalHours / 8)} days), which may be too long`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const getWorkflowMetrics = (stages: WorkflowStage[]) => {
  const totalDuration = stages.reduce((sum, stage) => sum + stage.estimated_duration_hours, 0);
  const requiredStages = stages.filter(s => s.is_required).length;
  const optionalStages = stages.length - requiredStages;
  const averageDuration = stages.length > 0 ? Math.round(totalDuration / stages.length) : 0;
  const estimatedDays = Math.ceil(totalDuration / 8);

  return {
    totalStages: stages.length,
    totalDuration,
    requiredStages,
    optionalStages,
    averageDuration,
    estimatedDays,
    complexity: stages.length <= 3 ? 'Simple' : stages.length <= 6 ? 'Moderate' : 'Complex'
  };
};
