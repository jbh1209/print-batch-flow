import { supabase } from "@/integrations/supabase/client";
import { ExcelImportDebugger } from "@/utils/excel";
import { TimingCalculationService } from "@/services/timingCalculationService";

interface JobData {
  id: string;
  wo_no: string;
}

interface StageData {
  id: string;
  stage_name: string;
}

interface JobStageInstance {
  id: string;
  job_id: string;
  production_stage_id: string;
  stage_specification_id: string | null;
  quantity: number | null;
  stage_order: number;
  part_name: string | null;
}

export class EnhancedJobCreator {
  private logger: ExcelImportDebugger;

  constructor(logger: ExcelImportDebugger) {
    this.logger = logger;
  }

  async createEnhancedJob(
    jobData: JobData,
    stageData: StageData[],
    jobTableName: string,
    quantityMap: Map<string, number>,
    defaultQty: number = 1
  ): Promise<void> {
    this.logger.addDebugInfo(`Starting enhanced job creation for job ${jobData.wo_no} (ID: ${jobData.id})`);

    // 1. Create Job
    await this.createJob(jobData, jobTableName);

    // 2. Create Production Stages
    await this.createProductionStages(stageData);

    // 3. Create Job Stage Instances
    await this.createJobStageInstances(jobData.id, stageData, jobTableName);

    // 4. Calculate Timing for Job
    await this.calculateTimingForJob(jobData.id, jobTableName, quantityMap, defaultQty);

    this.logger.addDebugInfo(`Enhanced job creation completed for job ${jobData.wo_no}`);
  }

  private async createJob(jobData: JobData, jobTableName: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(jobTableName)
        .update({ enhanced: true })
        .eq('id', jobData.id);

      if (error) {
        this.logger.addDebugInfo(`Error updating job ${jobData.wo_no} in ${jobTableName}: ${error.message}`);
        throw error;
      }

      this.logger.addDebugInfo(`Job ${jobData.wo_no} updated in ${jobTableName} to enhanced`);
    } catch (error: any) {
      this.logger.addDebugInfo(`Failed to update job ${jobData.wo_no} in ${jobTableName}: ${error.message}`);
      throw new Error(`Failed to update job ${jobData.wo_no} in ${jobTableName}: ${error.message}`);
    }
  }

  private async createProductionStages(stageData: StageData[]): Promise<void> {
    for (const stage of stageData) {
      try {
        const { data, error } = await supabase
          .from('production_stages')
          .select('id')
          .eq('id', stage.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          this.logger.addDebugInfo(`Error checking production stage ${stage.stage_name}: ${error.message}`);
          throw error;
        }

        if (!data) {
          const { error: insertError } = await supabase
            .from('production_stages')
            .insert([{ id: stage.id, stage_name: stage.stage_name }]);

          if (insertError) {
            this.logger.addDebugInfo(`Error creating production stage ${stage.stage_name}: ${insertError.message}`);
            throw insertError;
          }

          this.logger.addDebugInfo(`Production stage ${stage.stage_name} created`);
        } else {
          this.logger.addDebugInfo(`Production stage ${stage.stage_name} already exists`);
        }
      } catch (error: any) {
        this.logger.addDebugInfo(`Failed to create or check production stage ${stage.stage_name}: ${error.message}`);
        throw new Error(`Failed to create or check production stage ${stage.stage_name}: ${error.message}`);
      }
    }
  }

  private async createJobStageInstances(jobId: string, stageData: StageData[], jobTableName: string): Promise<void> {
    for (let i = 0; i < stageData.length; i++) {
      const stage = stageData[i];
      const stageOrder = i + 1;

      try {
        const { data, error } = await supabase
          .from('job_stage_instances')
          .select('id')
          .eq('job_id', jobId)
          .eq('production_stage_id', stage.id)
          .eq('job_table_name', jobTableName)
          .single();

        if (error && error.code !== 'PGRST116') {
          this.logger.addDebugInfo(`Error checking job stage instance for stage ${stage.stage_name}: ${error.message}`);
          throw error;
        }

        if (!data) {
          const { error: insertError } = await supabase
            .from('job_stage_instances')
            .insert([{
              job_id: jobId,
              production_stage_id: stage.id,
              stage_order: stageOrder,
              job_table_name: jobTableName
            }]);

          if (insertError) {
            this.logger.addDebugInfo(`Error creating job stage instance for stage ${stage.stage_name}: ${insertError.message}`);
            throw insertError;
          }

          this.logger.addDebugInfo(`Job stage instance created for stage ${stage.stage_name}`);
        } else {
          this.logger.addDebugInfo(`Job stage instance already exists for stage ${stage.stage_name}`);
        }
      } catch (error: any) {
        this.logger.addDebugInfo(`Failed to create or check job stage instance for stage ${stage.stage_name}: ${error.message}`);
        throw new Error(`Failed to create or check job stage instance for stage ${stage.stage_name}: ${error.message}`);
      }
    }
  }

  private async calculateTimingForJob(
    jobId: string,
    jobTableName: string,
    quantityMap: Map<string, number>,
    defaultQty: number = 1
  ): Promise<void> {
    this.logger.addDebugInfo(`Starting timing calculation for job ${jobId} in ${jobTableName}`);

    // Query job_stage_instances to get all stage instances for the job
    const { data: stageInstances, error } = await supabase
      .from('job_stage_instances')
      .select('id, production_stage_id, stage_specification_id, quantity, part_name, unique_stage_key')
      .eq('job_id', jobId)
      .eq('job_table_name', jobTableName)
      .order('stage_order');

    if (error) {
      this.logger.addDebugInfo(`Error fetching job stage instances for job ${jobId}: ${error.message}`);
      return;
    }

    if (!stageInstances || stageInstances.length === 0) {
      this.logger.addDebugInfo(`No stage instances found for job ${jobId}. Skipping timing calculation.`);
      return;
    }

    for (const stageInstance of stageInstances) {
      try {
        this.logger.addDebugInfo(`Calculating timing for stage instance ${stageInstance.id} (Stage: ${stageInstance.production_stage_id}, Specification: ${stageInstance.stage_specification_id})`);

        // Determine the quantity to use for timing calculation
        const quantity = quantityMap.get(stageInstance.unique_stage_key || stageInstance.production_stage_id) || defaultQty;

        this.logger.addDebugInfo(`Using quantity ${quantity} for stage instance ${stageInstance.id}`);

        // Call the TimingCalculationService to calculate the timing
        const timingEstimate = await TimingCalculationService.calculateStageTimingWithInheritance({
          quantity: quantity,
          stageId: stageInstance.production_stage_id,
          specificationId: stageInstance.stage_specification_id || undefined,
        });

        this.logger.addDebugInfo(`Timing calculation result for stage instance ${stageInstance.id}: ${JSON.stringify(timingEstimate)}`);

        // Update the job_stage_instances table with the calculated timing
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({
            estimated_duration_minutes: timingEstimate.estimatedDurationMinutes,
            production_minutes: timingEstimate.productionMinutes,
            make_ready_minutes: timingEstimate.makeReadyMinutes,
            speed_used: timingEstimate.speedUsed,
            speed_unit: timingEstimate.speedUnit,
            calculation_source: timingEstimate.calculationSource
          })
          .eq('id', stageInstance.id);

        if (updateError) {
          this.logger.addDebugInfo(`Error updating job stage instance ${stageInstance.id}: ${updateError.message}`);
        } else {
          this.logger.addDebugInfo(`Successfully updated job stage instance ${stageInstance.id} with timing data`);
        }
      } catch (error: any) {
        this.logger.addDebugInfo(`Error calculating timing for stage instance ${stageInstance.id}: ${error.message}`);
      }
    }

    this.logger.addDebugInfo(`Timing calculation completed for job ${jobId} in ${jobTableName}`);
  }
}
