import { supabase } from "@/integrations/supabase/client";
import type { ExcelImportDebugger } from "@/utils/excel";
import { TimingCalculationService } from "@/services/timingCalculationService";

interface UserApprovedMapping {
  groupName: string;
  mappedStageId: string;
  mappedStageName: string;
  category: string;
  mappedStageSpecId?: string;
  mappedStageSpecName?: string;
  paperSpecification?: string;
  partType?: string;
  qty?: number;
}

/**
 * Initialize job workflow using user-approved stage mappings directly
 * This bypasses the category-based workflow for enhanced job creation
 */
export const initializeJobWorkflowFromMappings = async (
  jobId: string,
  userApprovedMappings: UserApprovedMapping[],
  logger: ExcelImportDebugger
): Promise<boolean> => {
  logger.addDebugInfo(`🎯 Initializing workflow for job ${jobId} with ${userApprovedMappings.length} user-approved stage mappings`);
  
  if (userApprovedMappings.length === 0) {
    logger.addDebugInfo(`❌ No user-approved mappings provided for job ${jobId}, falling back to category-based workflow`);
    return false;
  }

  try {
    // First, get the correct stage order from production_stages table
    const { data: stageOrderData, error: stageOrderError } = await supabase
      .from('production_stages')
      .select('id, order_index')
      .in('id', userApprovedMappings.map(m => m.mappedStageId));

    if (stageOrderError) {
      logger.addDebugInfo(`❌ Failed to fetch stage ordering for job ${jobId}: ${stageOrderError.message}`);
      return false;
    }

    // Create a mapping of stage ID to order_index
    const stageOrderMap = new Map(stageOrderData.map(stage => [stage.id, stage.order_index]));

    // Sort mappings by the production stage order_index to maintain proper sequence
    const sortedMappings = [...userApprovedMappings].sort((a, b) => {
      const orderA = stageOrderMap.get(a.mappedStageId) || 999;
      const orderB = stageOrderMap.get(b.mappedStageId) || 999;
      return orderA - orderB;
    });

    logger.addDebugInfo(`📋 Stage workflow for job ${jobId} (${sortedMappings.length} stages in production sequence):`);
    sortedMappings.forEach((mapping, index) => {
      const orderIndex = stageOrderMap.get(mapping.mappedStageId) || 'unknown';
      logger.addDebugInfo(`   ${index + 1}. ${mapping.mappedStageName} (order: ${orderIndex}) - Category: ${mapping.category}`);
      if (mapping.mappedStageSpecName) {
        logger.addDebugInfo(`      └── Specification: ${mapping.mappedStageSpecName}`);
      }
      if (mapping.paperSpecification) {
        logger.addDebugInfo(`      └── Paper: ${mapping.paperSpecification}`);
      }
      if (mapping.qty) {
        logger.addDebugInfo(`      └── Quantity: ${mapping.qty}`);
      }
    });

    // ✨ NEW: Pre-aggregate mappings by production_stage_id to consolidate multi-spec stages
    const stageGroups = new Map<string, UserApprovedMapping[]>();
    sortedMappings.forEach(mapping => {
      const existing = stageGroups.get(mapping.mappedStageId) || [];
      existing.push(mapping);
      stageGroups.set(mapping.mappedStageId, existing);
    });
    
    logger.addDebugInfo(`🔍 Detected ${stageGroups.size} unique stages from ${sortedMappings.length} mappings`);
    
    // Build consolidated stage data for the new RPC function
    const consolidatedStages = Array.from(stageGroups.entries()).map(([stageId, mappings]) => {
      const stageOrder = stageOrderMap.get(stageId) || 999;
      
      // Create specifications array for this stage - PRESERVE ALL MAPPINGS, even those without spec IDs
      const specifications = mappings.map(m => ({
        specification_id: m.mappedStageSpecId || null,
        quantity: m.qty || null,
        paper_specification: m.paperSpecification || null
      }));
      // DO NOT filter out null spec IDs - they are valid manual entries
      
      logger.addDebugInfo(`📦 Consolidating stage ${stageId} with ${specifications.length} specification(s) from ${mappings.length} mappings`);
      
      // Log detailed spec info for debugging
      specifications.forEach((spec, idx) => {
        logger.addDebugInfo(`   Spec ${idx + 1}: ${spec.specification_id ? `ID=${spec.specification_id}` : 'NO_ID'}, qty=${spec.quantity}`);
      });
      
      return {
        stage_id: stageId,
        stage_order: stageOrder,
        specifications: specifications // Use ALL specifications as-is
      };
    });

    // Call the new multi-spec aware RPC function
    const { data, error } = await supabase.rpc('initialize_job_stages_with_multi_specs', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_consolidated_stages: consolidatedStages
    });

    if (error) {
      logger.addDebugInfo(`❌ Failed to initialize multi-spec workflow for job ${jobId}: ${error.message}`);
      return false;
    }

    logger.addDebugInfo(`✅ Successfully initialized multi-spec workflow for job ${jobId} (${consolidatedStages.length} stages created)`);
    
    // 🚀 TIMING CALCULATION: Calculate timing estimates for all created stages (including sub-tasks)
    await calculateTimingForCreatedStages(jobId, sortedMappings, logger);
    
    return true;

  } catch (error) {
    logger.addDebugInfo(`❌ Error initializing workflow for job ${jobId}: ${error}`);
    return false;
  }
};

/**
 * Initialize job workflow using category (fallback method)
 * This is the existing category-based workflow initialization
 */
export const initializeJobWorkflowFromCategory = async (
  jobId: string,
  categoryId: string,
  logger: ExcelImportDebugger
): Promise<boolean> => {
  logger.addDebugInfo(`📂 Initializing category-based workflow for job ${jobId} with category ${categoryId}`);
  
  try {
    const { data, error } = await supabase.rpc('initialize_job_stages_auto', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_category_id: categoryId
    });

    if (error) {
      logger.addDebugInfo(`❌ Failed to initialize category workflow for job ${jobId}: ${error.message}`);
      return false;
    }

    logger.addDebugInfo(`✅ Successfully initialized category workflow for job ${jobId}`);
    return true;

  } catch (error) {
    logger.addDebugInfo(`❌ Error initializing category workflow for job ${jobId}: ${error}`);
    return false;
  }
};

/**
 * Smart workflow initializer that uses user mappings if available, falls back to category
 */
export const initializeJobWorkflow = async (
  jobId: string,
  userApprovedMappings: UserApprovedMapping[],
  categoryId: string | null,
  logger: ExcelImportDebugger
): Promise<boolean> => {
  // Try user-approved mappings first (Enhanced Job Creation path)
  if (userApprovedMappings.length > 0) {
    const success = await initializeJobWorkflowFromMappings(jobId, userApprovedMappings, logger);
    if (success) {
      logger.addDebugInfo(`🎯 Using user-approved stage mappings for job ${jobId}`);
      return true;
    }
  }

  // Fall back to category-based workflow (Simple Job Creation path)
  if (categoryId) {
    const success = await initializeJobWorkflowFromCategory(jobId, categoryId, logger);
    if (success) {
      logger.addDebugInfo(`📂 Using category-based workflow for job ${jobId}`);
      return true;
    }
  }

  logger.addDebugInfo(`❌ Failed to initialize any workflow for job ${jobId}`);
  return false;
};

/**
 * Calculate timing estimates for all created stage instances
 */
async function calculateTimingForCreatedStages(
  jobId: string,
  userApprovedMappings: UserApprovedMapping[],
  logger: ExcelImportDebugger
): Promise<void> {
  try {
    logger.addDebugInfo(`🎯 Starting timing calculations for job ${jobId}`);
    
    // Fetch all stage instances for this job
    const { data: stageInstances, error } = await supabase
      .from('job_stage_instances')
      .select('id, production_stage_id, stage_specification_id, quantity, unique_stage_key')
      .eq('job_id', jobId)
      .eq('job_table_name', 'production_jobs')
      .order('stage_order');
    
    if (error) {
      logger.addDebugInfo(`❌ Failed to fetch stage instances for timing calculation: ${error.message}`);
      return;
    }
    
    if (!stageInstances || stageInstances.length === 0) {
      logger.addDebugInfo(`⚠️ No stage instances found for job ${jobId}, skipping timing calculation`);
      return;
    }
    
    // Create a map of unique stage keys to quantities from user mappings
    const quantityMap = new Map<string, number>();
    userApprovedMappings.forEach(mapping => {
      if (mapping.qty && mapping.qty > 0) {
        quantityMap.set(mapping.mappedStageId, mapping.qty);
      }
    });
    
    logger.addDebugInfo(`📊 Found ${quantityMap.size} stage quantities from user mappings`);
    
    // Calculate timing for each stage instance using its stored unique key
    const timingPromises = stageInstances.map(async (stageInstance) => {
      const uniqueKey = stageInstance.unique_stage_key;
      const quantity = uniqueKey ? quantityMap.get(uniqueKey) : null;
      const finalQuantity = quantity || stageInstance.quantity || 1;
      
      logger.addDebugInfo(`⏱️ Calculating timing for stage instance ${stageInstance.id} (key: ${uniqueKey}) with quantity ${finalQuantity}`);
      
      try {
        // Check if this stage has sub-tasks (multi-spec scenario)
        const { data: subTasks, error: subTaskError } = await supabase
          .from('stage_sub_tasks' as any)
          .select('id, stage_specification_id, quantity, estimated_duration_minutes')
          .eq('stage_instance_id', stageInstance.id)
          .order('sub_task_order');
        
        if (subTaskError) {
          logger.addDebugInfo(`⚠️ Could not fetch sub-tasks for stage ${stageInstance.id}: ${subTaskError.message}`);
        }
        
        let totalDurationMinutes = 0;
        
        // If sub-tasks exist, calculate and sum their durations
        if (subTasks && subTasks.length > 0) {
          logger.addDebugInfo(`🔍 Found ${subTasks.length} sub-tasks for stage ${stageInstance.id}, calculating individual durations`);
          
          for (const subTask of subTasks as any[]) {
            const subTaskQuantity = subTask.quantity || finalQuantity;
            const subTaskTiming = await TimingCalculationService.calculateStageTimingWithInheritance({
              quantity: subTaskQuantity,
              stageId: stageInstance.production_stage_id,
              specificationId: subTask.stage_specification_id
            });
            
            totalDurationMinutes += subTaskTiming.estimatedDurationMinutes;
            
            // Update sub-task with its estimated duration
            await supabase
              .from('stage_sub_tasks' as any)
              .update({
                estimated_duration_minutes: subTaskTiming.estimatedDurationMinutes,
                quantity: subTaskQuantity
              })
              .eq('id', subTask.id);
            
            logger.addDebugInfo(`   └── Sub-task ${subTask.id}: ${subTaskTiming.estimatedDurationMinutes} mins`);
          }
          
          logger.addDebugInfo(`✅ Total duration for multi-spec stage: ${totalDurationMinutes} mins (sum of ${subTasks.length} sub-tasks)`);
        } else {
          // Single-spec stage: calculate normally
          const timingResult = await TimingCalculationService.calculateStageTimingWithInheritance({
            quantity: finalQuantity,
            stageId: stageInstance.production_stage_id,
            specificationId: stageInstance.stage_specification_id
          });
          
          totalDurationMinutes = timingResult.estimatedDurationMinutes;
          logger.addDebugInfo(`✅ Single-spec stage duration: ${totalDurationMinutes} mins`);
        }
        
        // Update the stage instance with quantity and total duration
        const { error: updateError } = await supabase
          .from('job_stage_instances')
          .update({
            quantity: finalQuantity,
            estimated_duration_minutes: totalDurationMinutes,
            updated_at: new Date().toISOString()
          })
          .eq('id', stageInstance.id);
        
        if (updateError) {
          logger.addDebugInfo(`❌ Failed to update stage instance ${stageInstance.id}: ${updateError.message}`);
          return false;
        }
        
        logger.addDebugInfo(`✅ Updated stage instance ${stageInstance.id} with ${totalDurationMinutes} minutes`);
        return true;
      } catch (error) {
        logger.addDebugInfo(`❌ Error calculating timing for stage instance ${stageInstance.id}: ${error}`);
        return false;
      }
    });
    
    const results = await Promise.all(timingPromises);
    const successCount = results.filter(result => result === true).length;
    
    logger.addDebugInfo(`🎯 Timing calculation completed: ${successCount}/${stageInstances.length} successful`);
    
  } catch (error) {
    logger.addDebugInfo(`❌ Error in timing calculation process: ${error}`);
  }
}
