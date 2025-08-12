import { supabase } from "@/integrations/supabase/client";

export interface StageInstance {
  id: string;
  production_stage_id: string;
  stage_name: string;
  part_assignment: string | null;
  stage_order: number;
  estimated_duration_minutes: number;
  status: string;
}

export interface WorkflowPath {
  type: 'cover' | 'text' | 'convergence';
  stages: StageInstance[];
  dependencies: string[]; // stage IDs this path depends on
}

export interface JobWorkflow {
  jobId: string;
  coverPath: WorkflowPath;
  textPath: WorkflowPath;
  convergencePath: WorkflowPath;
}

export class WorkflowAnalyzer {
  /**
   * Parse job stage instances into parallel workflow paths
   * EXACT LOGIC: cover -> text -> convergence (both waits for cover+text completion)
   */
  async analyzeJobWorkflow(jobId: string, jobTableName: string = 'production_jobs'): Promise<JobWorkflow> {
    const { data: stageInstances, error } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        production_stage_id,
        part_assignment,
        stage_order,
        estimated_duration_minutes,
        status,
        production_stages(name)
      `)
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .order('stage_order');

    if (error || !stageInstances) {
      throw new Error(`Failed to fetch workflow for job ${jobId}: ${error?.message}`);
    }

    const stages: StageInstance[] = stageInstances.map(si => ({
      id: si.id,
      production_stage_id: si.production_stage_id,
      stage_name: (si.production_stages as any)?.name || 'Unknown Stage',
      part_assignment: si.part_assignment,
      stage_order: si.stage_order,
      estimated_duration_minutes: si.estimated_duration_minutes || 30,
      status: si.status
    }));

    return this.parseWorkflowPaths(jobId, stages);
  }

  private parseWorkflowPaths(jobId: string, stages: StageInstance[]): JobWorkflow {
    const coverPath: WorkflowPath = {
      type: 'cover',
      stages: stages.filter(s => s.part_assignment === 'cover'),
      dependencies: []
    };

    const textPath: WorkflowPath = {
      type: 'text', 
      stages: stages.filter(s => s.part_assignment === 'text'),
      dependencies: []
    };

    const convergencePath: WorkflowPath = {
      type: 'convergence',
      stages: stages.filter(s => s.part_assignment === 'both' || s.part_assignment === null),
      dependencies: [] // Will be set by scheduler based on cover/text completion
    };

    return {
      jobId,
      coverPath,
      textPath,
      convergencePath
    };
  }

  /**
   * Check if a stage can start based on workflow dependencies
   */
  canStageStart(workflow: JobWorkflow, stageId: string): { canStart: boolean; blockedBy: string[] } {
    // Find which path this stage belongs to
    const allStages = [...workflow.coverPath.stages, ...workflow.textPath.stages, ...workflow.convergencePath.stages];
    const targetStage = allStages.find(s => s.id === stageId);
    
    if (!targetStage) {
      return { canStart: false, blockedBy: ['Stage not found in workflow'] };
    }

    // Convergence stages must wait for both cover and text paths to complete
    if (workflow.convergencePath.stages.some(s => s.id === stageId)) {
      const coverComplete = workflow.coverPath.stages.every(s => s.status === 'completed');
      const textComplete = workflow.textPath.stages.every(s => s.status === 'completed');
      
      if (!coverComplete || !textComplete) {
        const blocked = [];
        if (!coverComplete) blocked.push('Cover path not complete');
        if (!textComplete) blocked.push('Text path not complete');
        return { canStart: false, blockedBy: blocked };
      }
    }

    // Within each path, stages must complete in order
    const pathStages = workflow.coverPath.stages.includes(targetStage) ? workflow.coverPath.stages :
                      workflow.textPath.stages.includes(targetStage) ? workflow.textPath.stages :
                      workflow.convergencePath.stages;

    const targetOrder = targetStage.stage_order;
    const blockingStages = pathStages
      .filter(s => s.stage_order < targetOrder && s.status !== 'completed')
      .map(s => s.stage_name);

    return {
      canStart: blockingStages.length === 0,
      blockedBy: blockingStages
    };
  }
}

export const workflowAnalyzer = new WorkflowAnalyzer();