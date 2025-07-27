import { supabase } from "@/integrations/supabase/client";
import { DependencyChain } from "@/utils/parallelStageUtils";

interface StageNode {
  stageId: string;
  stageName: string;
  predecessors: string[];
  successors: string[];
  isParallel: boolean;
  estimatedDuration: number;
  earliestStart: number;
  latestStart: number;
  slack: number;
}

interface CriticalPathResult {
  path: string[];
  totalDuration: number;
  bottleneckStages: string[];
  parallelOpportunities: Array<{
    stages: string[];
    duration: number;
  }>;
}

export class DependencyResolver {
  /**
   * Analyze job workflow and identify critical path
   */
  async analyzeCriticalPath(jobId: string, jobTableName: string): Promise<CriticalPathResult> {
    // Get job stage instances with dependencies
    const { data: stageInstances, error } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        production_stage_id,
        stage_order,
        estimated_duration_minutes,
        status,
        production_stages!inner(name, running_speed_per_hour, make_ready_time_minutes)
      `)
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .order('stage_order');

    if (error) {
      console.error('Error fetching stage instances:', error);
      throw error;
    }

    if (!stageInstances || stageInstances.length === 0) {
      return {
        path: [],
        totalDuration: 0,
        bottleneckStages: [],
        parallelOpportunities: []
      };
    }

    // Build stage nodes with dependencies
    const stageNodes = this.buildStageNodes(stageInstances);
    
    // Calculate critical path using forward and backward pass
    const criticalPath = this.calculateCriticalPath(stageNodes);
    
    // Identify parallel processing opportunities
    const parallelOpportunities = this.identifyParallelOpportunities(stageNodes);
    
    // Find bottleneck stages (stages with zero slack)
    const bottleneckStages = stageNodes
      .filter(node => node.slack === 0)
      .map(node => node.stageId);

    return {
      path: criticalPath,
      totalDuration: Math.max(...stageNodes.map(node => node.earliestStart + node.estimatedDuration)),
      bottleneckStages,
      parallelOpportunities
    };
  }

  /**
   * Simplified stage check - table removed to prevent constraint violations
   */
  async canStageStart(
    jobId: string, 
    jobTableName: string, 
    stageId: string
  ): Promise<{
    canStart: boolean;
    blockedBy: string[];
    reason: string;
  }> {
    // Simplified logic - check previous stage completion based on stage order
    const { data: currentStage, error } = await supabase
      .from('job_stage_instances')
      .select('stage_order')
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .eq('production_stage_id', stageId)
      .single();

    if (error || !currentStage) {
      return {
        canStart: false,
        blockedBy: [],
        reason: 'Stage not found'
      };
    }

    // Check if previous stage (if any) is completed
    if (currentStage.stage_order > 1) {
      const { data: previousStage, error: prevError } = await supabase
        .from('job_stage_instances')
        .select('status, production_stages!inner(name)')
        .eq('job_id', jobId)
        .eq('job_table_name', jobTableName)
        .eq('stage_order', currentStage.stage_order - 1)
        .single();

      if (prevError || !previousStage || previousStage.status !== 'completed') {
        return {
          canStart: false,
          blockedBy: [(previousStage as any)?.production_stages?.name || 'Previous stage'],
          reason: 'Previous stage not completed'
        };
      }
    }

    return {
      canStart: true,
      blockedBy: [],
      reason: 'Dependencies satisfied'
    };
  }

  /**
   * Get next stages that can be activated
   */
  async getNextAvailableStages(
    jobId: string, 
    jobTableName: string
  ): Promise<Array<{
    stageId: string;
    stageName: string;
    canStart: boolean;
    blockedBy: string[];
    reason: string;
    priority: number;
  }>> {
    // Get pending stages
    const { data: pendingStages, error } = await supabase
      .from('job_stage_instances')
      .select(`
        production_stage_id,
        stage_order,
        production_stages!inner(name)
      `)
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .eq('status', 'pending')
      .order('stage_order');

    if (error) {
      console.error('Error fetching pending stages:', error);
      return [];
    }

    if (!pendingStages) return [];

    const availableStages = [];

    for (const stage of pendingStages) {
      const dependencyCheck = await this.canStageStart(
        jobId, 
        jobTableName, 
        stage.production_stage_id
      );

      availableStages.push({
        stageId: stage.production_stage_id,
        stageName: (stage as any).production_stages.name,
        canStart: dependencyCheck.canStart,
        blockedBy: dependencyCheck.blockedBy,
        reason: dependencyCheck.reason,
        priority: dependencyCheck.canStart ? 1 : 0 // Higher priority for stages that can start
      });
    }

    return availableStages
      .sort((a, b) => b.priority - a.priority)
      .map(({ priority, ...rest }) => rest); // Remove priority from final result
  }

  /**
   * Disabled - job flow dependencies table removed to prevent constraint violations
   */
  async createJobFlowDependencies(
    jobId: string, 
    jobTableName: string
  ): Promise<void> {
    // Table removed to prevent database constraint violations during Excel import
    console.log(`Job flow dependencies disabled for job ${jobId}`);
  }

  /**
   * Private helper methods
   */
  private buildStageNodes(stageInstances: any[]): StageNode[] {
    return stageInstances.map((stage, index) => ({
      stageId: stage.production_stage_id,
      stageName: (stage as any).production_stages.name,
      predecessors: index > 0 ? [stageInstances[index - 1].production_stage_id] : [],
      successors: index < stageInstances.length - 1 ? [stageInstances[index + 1].production_stage_id] : [],
      isParallel: false, // Will be enhanced in future for parallel stages
      estimatedDuration: stage.estimated_duration_minutes || 60,
      earliestStart: 0,
      latestStart: 0,
      slack: 0
    }));
  }

  private calculateCriticalPath(stageNodes: StageNode[]): string[] {
    // Forward pass - calculate earliest start times
    stageNodes.forEach(node => {
      if (node.predecessors.length === 0) {
        node.earliestStart = 0;
      } else {
        const maxPredecessorFinish = Math.max(
          ...node.predecessors.map(predId => {
            const pred = stageNodes.find(n => n.stageId === predId);
            return pred ? pred.earliestStart + pred.estimatedDuration : 0;
          })
        );
        node.earliestStart = maxPredecessorFinish;
      }
    });

    // Backward pass - calculate latest start times and slack
    const projectDuration = Math.max(
      ...stageNodes.map(node => node.earliestStart + node.estimatedDuration)
    );

    stageNodes.reverse().forEach(node => {
      if (node.successors.length === 0) {
        node.latestStart = projectDuration - node.estimatedDuration;
      } else {
        const minSuccessorStart = Math.min(
          ...node.successors.map(succId => {
            const succ = stageNodes.find(n => n.stageId === succId);
            return succ ? succ.latestStart : projectDuration;
          })
        );
        node.latestStart = minSuccessorStart - node.estimatedDuration;
      }
      
      node.slack = node.latestStart - node.earliestStart;
    });

    // Critical path consists of stages with zero slack
    return stageNodes
      .filter(node => node.slack === 0)
      .sort((a, b) => a.earliestStart - b.earliestStart)
      .map(node => node.stageId);
  }

  private identifyParallelOpportunities(stageNodes: StageNode[]): Array<{
    stages: string[];
    duration: number;
  }> {
    // Look for stages that could potentially run in parallel
    // This is a simplified implementation - can be enhanced for complex workflows
    const opportunities = [];
    
    // Group stages by their earliest start time
    const stagesByStartTime = new Map<number, StageNode[]>();
    stageNodes.forEach(node => {
      const startTime = node.earliestStart;
      if (!stagesByStartTime.has(startTime)) {
        stagesByStartTime.set(startTime, []);
      }
      stagesByStartTime.get(startTime)!.push(node);
    });

    // Identify groups with multiple stages (potential parallel opportunities)
    stagesByStartTime.forEach((stages, startTime) => {
      if (stages.length > 1) {
        opportunities.push({
          stages: stages.map(s => s.stageId),
          duration: Math.max(...stages.map(s => s.estimatedDuration))
        });
      }
    });

    return opportunities;
  }
}

export const dependencyResolver = new DependencyResolver();