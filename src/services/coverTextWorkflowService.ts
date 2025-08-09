import { supabase } from '@/integrations/supabase/client';
import type { CoverTextDetection, ParsedJob } from '@/utils/excel/types';
import type { ExcelImportDebugger } from '@/utils/excel/debugger';

export interface CoverTextWorkflowResult {
  success: boolean;
  coverStageInstances: any[];
  textStageInstances: any[];
  dependencyGroupId: string;
  error?: string;
}

export class CoverTextWorkflowService {
  constructor(private logger: ExcelImportDebugger) {}

  async createCoverTextWorkflow(
    jobId: string,
    job: ParsedJob,
    categoryId: string
  ): Promise<CoverTextWorkflowResult> {
    
    if (!job.cover_text_detection?.isBookJob) {
      throw new Error('Job is not a book job - cannot create cover/text workflow');
    }

    const detection = job.cover_text_detection;
    this.logger.addDebugInfo(`Creating cover/text workflow for job ${jobId}`);

    try {
      // Get category production stages to determine workflow order
      const { data: categoryStages, error: stagesError } = await supabase
        .from('category_production_stages')
        .select(`
          stage_order,
          production_stage_id,
          production_stages!inner (
            id,
            name,
            supports_parts
          )
        `)
        .eq('category_id', categoryId)
        .order('stage_order');

      if (stagesError) {
        throw new Error(`Failed to get category stages: ${stagesError.message}`);
      }

      // Create stage instances for cover and text components
      const coverStageInstances = await this.createComponentStageInstances(
        jobId,
        detection.components.find(c => c.type === 'cover')!,
        categoryStages || [],
        detection.dependencyGroupId!,
        categoryId
      );

      const textStageInstances = await this.createComponentStageInstances(
        jobId,
        detection.components.find(c => c.type === 'text')!,
        categoryStages || [],
        detection.dependencyGroupId!,
        categoryId
      );

      this.logger.addDebugInfo(`Created ${coverStageInstances.length} cover stages and ${textStageInstances.length} text stages`);

      return {
        success: true,
        coverStageInstances,
        textStageInstances,
        dependencyGroupId: detection.dependencyGroupId!
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.addDebugInfo(`Failed to create cover/text workflow: ${errorMessage}`);
      
      return {
        success: false,
        coverStageInstances: [],
        textStageInstances: [],
        dependencyGroupId: detection.dependencyGroupId!,
        error: errorMessage
      };
    }
  }

  private async createComponentStageInstances(
    jobId: string,
    component: any,
    categoryStages: any[],
    dependencyGroupId: string,
    categoryId: string
  ): Promise<any[]> {
    const stageInstances = [];
    
    for (const stage of categoryStages) {
      const production_stage_name = stage.production_stages.name;
      
      // Determine if this stage should wait for dependencies (synchronization stages)
      const shouldWaitForDependency = this.shouldWaitForDependency(production_stage_name);
      
      // Parallel stages (Cover/Text printing) get no dependency group
      // Synchronization stages (Hunkeler, Perfect Binding, etc.) get the dependency group
      const assignedDependencyGroup = shouldWaitForDependency ? dependencyGroupId : null;
      
      const stageInstance = {
        job_id: jobId,
        job_table_name: 'production_jobs',
        category_id: categoryId,
        production_stage_id: stage.production_stage_id,
        stage_order: stage.stage_order,
        status: 'pending', // All stages start as pending
        part_assignment: component.type, // 'cover' or 'text'
        quantity: component.quantity || component.printing?.wo_qty,
        dependency_group: assignedDependencyGroup,
        part_name: `${component.type} - ${component.description || component.type}`,
        notes: `Part: ${component.type}, Quantity: ${component.quantity || component.printing?.wo_qty}${shouldWaitForDependency ? ' [Waits for both Cover & Text]' : ''}`,
        estimated_duration_minutes: stage.estimated_duration_hours ? stage.estimated_duration_hours * 60 : null,
        setup_time_minutes: 10 // Default setup time
      };

      const { data, error } = await supabase
        .from('job_stage_instances')
        .insert(stageInstance)
        .select()
        .single();

      if (error) {
        this.logger.addDebugInfo(`Failed to create stage instance: ${error.message}`);
        throw error;
      }

      this.logger.addDebugInfo(`Created stage instance: ${production_stage_name} for ${component.type} with dependency group: ${assignedDependencyGroup}`);

      stageInstances.push(data);
    }

    return stageInstances;
  }

  private shouldWaitForDependency(stageName: string): boolean {
    // TRUE synchronization stages that require both cover and text to be completed
    // These are stages where cover and text parts come together
    const trueSynchronizationStages = [
      'Perfect Binding', 
      'Saddle Stitching',
      'Collating',
      'Assembly',
      'Binding',
      'Final Assembly',
      'Quality Check',
      'Packing',
      'Dispatch',
      'Gathering',
      'Collection',
      'Delivery',
      'Final Trimming', // Final trimming after gathering
      'Inspection', // Final inspection of assembled product
      'Packaging' // Final packaging of complete product
    ];
    
    // Part-specific finishing stages that should NOT wait for dependencies:
    // - Hunkeler (text-specific finishing)
    // - UV Varnishing (cover-specific finishing) 
    // - Laminating (part-specific)
    // - Die Cutting (part-specific)
    
    return trueSynchronizationStages.some(depStage => 
      stageName.toLowerCase().includes(depStage.toLowerCase())
    );
  }
}