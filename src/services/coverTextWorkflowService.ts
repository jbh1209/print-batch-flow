import { supabase } from '@/integrations/supabase/client';
import type { CoverTextDetection, ParsedJob } from '@/utils/excel/types';
import type { ExcelImportDebugger } from '@/utils/excel/debugger';
import { determineComponentForStage } from '@/utils/tracker/partAutoAssignment';

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

      // Create 'both' stage instances with the same dependency_group
      const bothStageInstances = await this.createBothStageInstances(
        jobId,
        categoryStages || [],
        detection.dependencyGroupId!,
        categoryId
      );

      this.logger.addDebugInfo(`Created ${coverStageInstances.length} cover stages, ${textStageInstances.length} text stages, and ${bothStageInstances.length} 'both' stages`);

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
    const hasCoverAndText = true; // We know this is a book job with both

    // Identify merge points: where the next 'both' stage begins
    const mergePoints = new Set<number>();
    for (let i = 0; i < categoryStages.length; i++) {
      const stage = categoryStages[i].production_stages;
      const componentForStage = determineComponentForStage(stage.name, hasCoverAndText);
      
      if (componentForStage === 'both') {
        mergePoints.add(categoryStages[i].stage_order);
      }
    }

    for (const [index, categoryStage] of categoryStages.entries()) {
      const stage = categoryStage.production_stages;
      const isFirstStage = index === 0;
      
      // Determine if this stage should be created for this component
      const componentForStage = determineComponentForStage(stage.name, hasCoverAndText);
      
      // Skip this stage if it's not meant for this component
      if (componentForStage === 'cover' && component.type !== 'cover') {
        this.logger.addDebugInfo(`Skipping ${stage.name} for ${componentName} (stage is for cover only)`);
        continue;
      }
      if (componentForStage === 'text' && component.type !== 'text') {
        this.logger.addDebugInfo(`Skipping ${stage.name} for ${componentName} (stage is for text only)`);
        continue;
      }
      
      // Determine if this component stage is the last before a merge point
      const isLastBeforeMerge = this.isLastPartStageBeforeMerge(
        categoryStages,
        index,
        component.type,
        hasCoverAndText
      );
      
      const stageInstance = {
        job_id: jobId,
        job_table_name: 'production_jobs',
        category_id: categoryId,
        production_stage_id: stage.id,
        stage_order: categoryStage.stage_order,
        part_name: componentName,
        part_type: 'printing_component',
        part_assignment: componentName.toLowerCase(), // Cover or Text
        // Assign dependency_group ONLY to the last cover/text stage before a merge
        dependency_group: isLastBeforeMerge ? dependencyGroupId : null,
        quantity: component.printing.wo_qty,
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
      this.logger.addDebugInfo(`Created ${componentName} stage: ${stage.name} (order: ${categoryStage.stage_order}, dep_group: ${isLastBeforeMerge ? 'assigned' : 'null'})`);
    }

    return stageInstances;
  }

  private isLastPartStageBeforeMerge(
    categoryStages: any[],
    currentIndex: number,
    componentType: string,
    hasCoverAndText: boolean
  ): boolean {
    // Look ahead to find the next 'both' stage
    for (let i = currentIndex + 1; i < categoryStages.length; i++) {
      const nextStage = categoryStages[i].production_stages;
      const nextComponentForStage = determineComponentForStage(nextStage.name, hasCoverAndText);
      
      // If we find a 'both' stage, this is the last part stage before merge
      if (nextComponentForStage === 'both') {
        return true;
      }
      
      // If we find another stage for this component, it's not the last
      if (nextComponentForStage === componentType) {
        return false;
      }
    }
    
    // No merge point found ahead
    return false;
  }

  private async createBothStageInstances(
    jobId: string,
    categoryStages: any[],
    dependencyGroupId: string,
    categoryId: string
  ): Promise<any[]> {
    const stageInstances: any[] = [];
    const hasCoverAndText = true;

    for (const categoryStage of categoryStages) {
      const stage = categoryStage.production_stages;
      const componentForStage = determineComponentForStage(stage.name, hasCoverAndText);
      
      // Only create 'both' stages
      if (componentForStage !== 'both') {
        continue;
      }
      
      const stageInstance = {
        job_id: jobId,
        job_table_name: 'production_jobs',
        category_id: categoryId,
        production_stage_id: stage.id,
        stage_order: categoryStage.stage_order,
        part_name: 'Both',
        part_type: 'printing_component',
        part_assignment: 'both',
        // Assign the shared dependency_group for synchronization
        dependency_group: dependencyGroupId,
        quantity: null, // 'Both' stages don't have individual quantities
        status: 'pending',
        started_at: null,
        started_by: null
      };

      const { data: insertedStage, error } = await supabase
        .from('job_stage_instances')
        .insert(stageInstance)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create 'both' stage instance: ${error.message}`);
      }

      stageInstances.push(insertedStage);
      this.logger.addDebugInfo(`Created 'both' stage: ${stage.name} (order: ${categoryStage.stage_order}) with dependency_group`);
    }

    return stageInstances;
  }
}