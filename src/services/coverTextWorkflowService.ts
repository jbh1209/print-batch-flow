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
    
    const componentName = component.type.charAt(0).toUpperCase() + component.type.slice(1);
    const stageInstances: any[] = [];

    for (const [index, categoryStage] of categoryStages.entries()) {
      const stage = categoryStage.production_stages;
      const isFirstStage = index === 0;
      
      // Determine if this stage needs dependency synchronization
      const needsSynchronization = this.shouldWaitForDependency(stage.name);
      
      const stageInstance = {
        job_id: jobId,
        job_table_name: 'production_jobs',
        category_id: categoryId,
        production_stage_id: stage.id,
        stage_order: categoryStage.stage_order,
        part_name: componentName,
        part_type: 'printing_component',
        dependency_group: needsSynchronization ? dependencyGroupId : null,
        quantity: component.printing.qty, // Fixed: use qty instead of wo_qty
        status: isFirstStage ? 'active' : 'pending',
        started_at: isFirstStage ? new Date().toISOString() : null,
        started_by: isFirstStage ? null : null // Will be set by the system
      };

      const { data: insertedStage, error } = await supabase
        .from('job_stage_instances')
        .insert(stageInstance)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create stage instance for ${componentName}: ${error.message}`);
      }

      stageInstances.push(insertedStage);
      this.logger.addDebugInfo(`Created ${componentName} stage: ${stage.name} (order: ${categoryStage.stage_order})`);
    }

    return stageInstances;
  }

  private shouldWaitForDependency(stageName: string): boolean {
    // Stages that should wait for both cover and text to complete
    const synchronizationStages = [
      'gathering',
      'binding',
      'delivery',
      'collection',
      'packing',
      'dispatch'
    ];

    return synchronizationStages.some(syncStage => 
      stageName.toLowerCase().includes(syncStage.toLowerCase())
    );
  }
}
