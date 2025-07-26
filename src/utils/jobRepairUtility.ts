import { supabase } from "@/integrations/supabase/client";
import { TimingCalculationService } from "@/services/timingCalculationService";

export interface JobRepairResult {
  success: boolean;
  repairedJobs: number;
  failedJobs: number;
  totalProcessed: number;
  errors: string[];
  details: Array<{
    jobId: string;
    woNo: string;
    stageName: string;
    specificationFound: boolean;
    timingRecalculated: boolean;
    error?: string;
  }>;
}

/**
 * Repair utility to fix missing stage_specification_id links in job_stage_instances
 * and recalculate timing estimates for jobs with broken specifications
 */
export class JobRepairUtility {
  
  /**
   * Find and repair job stage instances with missing stage_specification_id
   * by matching them against excel import mappings
   */
  static async repairMissingStageSpecifications(): Promise<JobRepairResult> {
    console.log('🔧 Starting job stage specification repair...');
    
    const result: JobRepairResult = {
      success: false,
      repairedJobs: 0,
      failedJobs: 0,
      totalProcessed: 0,
      errors: [],
      details: []
    };

    try {
      // Find job stage instances that have no stage_specification_id but should have one
      const { data: brokenStages, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select(`
          id,
          job_id,
          production_stage_id,
          stage_specification_id,
          quantity,
          estimated_duration_minutes,
          production_stage:production_stages(
            id,
            name,
            running_speed_per_hour,
            make_ready_time_minutes,
            speed_unit
          )
        `)
        .is('stage_specification_id', null)
        .eq('job_table_name', 'production_jobs')
        .not('production_stage_id', 'is', null);

      if (fetchError) {
        result.errors.push(`Failed to fetch broken stages: ${fetchError.message}`);
        return result;
      }

      if (!brokenStages || brokenStages.length === 0) {
        console.log('✅ No broken stage specifications found');
        result.success = true;
        return result;
      }

      console.log(`🔍 Found ${brokenStages.length} job stage instances with missing specifications`);

      // Get all excel import mappings for specification lookup
      const { data: mappings, error: mappingsError } = await supabase
        .from('excel_import_mappings')
        .select('*')
        .eq('is_verified', true)
        .not('stage_specification_id', 'is', null);

      if (mappingsError) {
        result.errors.push(`Failed to fetch mappings: ${mappingsError.message}`);
        return result;
      }

      const mappingsMap = new Map(
        (mappings || []).map(m => [m.excel_text.toLowerCase().trim(), m])
      );

      console.log(`📋 Loaded ${mappingsMap.size} verified specification mappings`);

      // Get job data separately for more reliable queries
      const jobIds = [...new Set(brokenStages.map(s => s.job_id))];
      const { data: jobsData } = await supabase
        .from('production_jobs')
        .select('id, wo_no, operation_quantities')
        .in('id', jobIds);
      
      const jobsMap = new Map(jobsData?.map(job => [job.id, job]) || []);

      // Process each broken stage instance
      for (const stage of brokenStages) {
        result.totalProcessed++;
        
        try {
          const stageName = stage.production_stage?.name || '';
          const jobData = jobsMap.get(stage.job_id);
          const woNo = jobData?.wo_no || 'Unknown';
          const operationQuantities = jobData?.operation_quantities || {};

          console.log(`🔧 Processing stage ${stageName} for job ${woNo}`);

          // Try to find matching specification from excel mappings
          let foundSpecId: string | null = null;
          let foundSpecName = '';

          // Look for direct stage name match
          const directMatch = mappingsMap.get(stageName.toLowerCase().trim());
          if (directMatch?.stage_specification_id) {
            foundSpecId = directMatch.stage_specification_id;
            foundSpecName = stageName;
          }

          // Look for operation quantities match (for multi-part jobs like cover/text)
          if (!foundSpecId && operationQuantities) {
            for (const [opKey, opData] of Object.entries(operationQuantities)) {
              if (typeof opData === 'object' && opData !== null) {
                const opMatch = mappingsMap.get(opKey.toLowerCase().trim());
                if (opMatch?.stage_specification_id && 
                    opMatch.production_stage_id === stage.production_stage_id) {
                  foundSpecId = opMatch.stage_specification_id;
                  foundSpecName = opKey;
                  break;
                }
              }
            }
          }

          if (foundSpecId) {
            // Update the stage instance with the found specification
            const { error: updateError } = await supabase
              .from('job_stage_instances')
              .update({
                stage_specification_id: foundSpecId,
                updated_at: new Date().toISOString()
              })
              .eq('id', stage.id);

            if (updateError) {
              result.failedJobs++;
              result.errors.push(`Failed to update stage ${stage.id}: ${updateError.message}`);
              result.details.push({
                jobId: stage.job_id,
                woNo,
                stageName,
                specificationFound: true,
                timingRecalculated: false,
                error: updateError.message
              });
              continue;
            }

            // Recalculate timing with the new specification
            let timingRecalculated = false;
            if (stage.quantity && stage.quantity > 0) {
              try {
                const timingResult = await TimingCalculationService.calculateStageTimingWithInheritance({
                  quantity: stage.quantity,
                  stageId: stage.production_stage_id,
                  specificationId: foundSpecId
                });

                const { error: timingError } = await supabase
                  .from('job_stage_instances')
                  .update({
                    estimated_duration_minutes: timingResult.estimatedDurationMinutes,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', stage.id);

                if (!timingError) {
                  timingRecalculated = true;
                  console.log(`✅ Updated timing for ${stageName}: ${timingResult.estimatedDurationMinutes} minutes`);
                }
              } catch (timingError) {
                console.warn(`⚠️ Failed to recalculate timing for stage ${stage.id}:`, timingError);
              }
            }

            result.repairedJobs++;
            result.details.push({
              jobId: stage.job_id,
              woNo,
              stageName,
              specificationFound: true,
              timingRecalculated
            });

            console.log(`✅ Repaired ${stageName} for job ${woNo} with specification ${foundSpecName}`);
          } else {
            result.details.push({
              jobId: stage.job_id,
              woNo,
              stageName,
              specificationFound: false,
              timingRecalculated: false
            });
            console.log(`⚠️ No specification found for ${stageName} in job ${woNo}`);
          }

        } catch (error) {
          result.failedJobs++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Error processing stage ${stage.id}: ${errorMessage}`);
          console.error(`❌ Error processing stage ${stage.id}:`, error);
        }
      }

      result.success = result.errors.length === 0;
      console.log(`🏁 Repair completed: ${result.repairedJobs} repaired, ${result.failedJobs} failed`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`Repair utility error: ${errorMessage}`);
      console.error('❌ Job repair utility error:', error);
    }

    return result;
  }

  /**
   * Find jobs with suspicious timing estimates (using default 100 sheets/hour)
   * and attempt to fix their stage specification links
   */
  static async findJobsWithSuspiciousTiming(): Promise<Array<{
    jobId: string;
    woNo: string;
    stageName: string;
    quantity: number;
    estimatedMinutes: number;
    calculatedSheetsPerHour: number;
    needsRepair: boolean;
  }>> {
    console.log('🔍 Analyzing jobs for suspicious timing estimates...');

    const { data: suspiciousStages, error } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        job_id,
        quantity,
        estimated_duration_minutes,
        production_stage:production_stages(name)
      `)
      .eq('job_table_name', 'production_jobs')
      .not('quantity', 'is', null)
      .not('estimated_duration_minutes', 'is', null)
      .gt('quantity', 0)
      .gt('estimated_duration_minutes', 0);

    if (error) {
      console.error('Failed to fetch stage timing data:', error);
      return [];
    }

    // Get job data separately for more reliable queries
    const jobIds = [...new Set((suspiciousStages || []).map(s => s.job_id))];
    const { data: jobsData } = await supabase
      .from('production_jobs')
      .select('id, wo_no')
      .in('id', jobIds);
    
    const jobsMap = new Map(jobsData?.map(job => [job.id, job]) || []);

    const analysis = (suspiciousStages || []).map(stage => {
      const quantity = stage.quantity || 0;
      const minutes = stage.estimated_duration_minutes || 0;
      const jobData = jobsMap.get(stage.job_id);
      
      // Calculate implied sheets per hour (assuming 10 min setup time)
      const productionMinutes = Math.max(minutes - 10, 1);
      const calculatedSheetsPerHour = Math.round((quantity / productionMinutes) * 60);
      
      // Flag as suspicious if it's close to default 100 sheets/hour
      const needsRepair = calculatedSheetsPerHour >= 90 && calculatedSheetsPerHour <= 110;

      return {
        jobId: stage.job_id,
        woNo: jobData?.wo_no || 'Unknown',
        stageName: stage.production_stage?.name || 'Unknown',
        quantity,
        estimatedMinutes: minutes,
        calculatedSheetsPerHour,
        needsRepair
      };
    });

    const suspiciousCount = analysis.filter(a => a.needsRepair).length;
    console.log(`🚨 Found ${suspiciousCount} stages with suspicious timing (likely using default 100 sheets/hour)`);

    return analysis.filter(a => a.needsRepair);
  }
}