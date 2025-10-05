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

    // MULTI-SPECIFICATION HANDWORK: Group mappings by stage ID to detect multi-spec scenarios
    const stageGroups = new Map<string, UserApprovedMapping[]>();
    sortedMappings.forEach(mapping => {
      const existing = stageGroups.get(mapping.mappedStageId) || [];
      existing.push(mapping);
      stageGroups.set(mapping.mappedStageId, existing);
    });
    
    logger.addDebugInfo(`🔍 Detected ${stageGroups.size} unique stages from ${sortedMappings.length} mappings`);
    
    // Create the enhanced database function call with specifications
    // Track stage ID usage to handle duplicates by appending suffixes
    const stageIdCounts = new Map<string, number>();
    
    const stageMappingsData = sortedMappings.map((mapping) => {
      // Check if this stage ID has been used before
      const currentCount = stageIdCounts.get(mapping.mappedStageId) || 0;
      stageIdCounts.set(mapping.mappedStageId, currentCount + 1);
      
      // If this is the 2nd+ occurrence, append suffix for uniqueness
      let uniqueStageId = mapping.mappedStageId;
      if (currentCount > 0) {
        uniqueStageId = `${mapping.mappedStageId}-${currentCount + 1}`;
      }
      
      const stageData = {
        stage_id: mapping.mappedStageId, // Keep original for production_stage_id reference
        unique_stage_id: uniqueStageId, // For uniqueness tracking
        stage_order: stageOrderMap.get(mapping.mappedStageId) || 999, // Use actual production stage order_index
        stage_specification_id: mapping.mappedStageSpecId || null, // ✅ FIXED: Ensure specification ID is preserved
        part_name: mapping.partType || null,
        quantity: mapping.qty || null,
        paper_specification: mapping.paperSpecification || null
      };
      
      // Debug logging for each stage mapping
      logger.addDebugInfo(`🔍 Stage mapping data for ${mapping.mappedStageName}:`);
      logger.addDebugInfo(`   - Production Stage ID: ${stageData.stage_id}`);
      logger.addDebugInfo(`   - Unique Instance ID: ${stageData.unique_stage_id}`);
      logger.addDebugInfo(`   - Stage Order: ${stageData.stage_order}`);
      logger.addDebugInfo(`   - Specification ID: ${stageData.stage_specification_id}`);
      logger.addDebugInfo(`   - Part Name: ${stageData.part_name}`);
      logger.addDebugInfo(`   - Quantity: ${stageData.quantity}`);
      logger.addDebugInfo(`   - Paper Specification: ${stageData.paper_specification}`);
      
      return stageData;
    });

    const { data, error } = await supabase.rpc('initialize_custom_job_stages_with_specs', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_stage_mappings: stageMappingsData
    });

    if (error) {
      logger.addDebugInfo(`❌ Failed to initialize custom workflow with specs for job ${jobId}: ${error.message}`);
      // Fallback to simple version without specifications
      logger.addDebugInfo(`🔄 Falling back to simple stage initialization...`);
      
      const stageIds = sortedMappings.map(mapping => mapping.mappedStageId);
      const stageOrders = sortedMappings.map(mapping => stageOrderMap.get(mapping.mappedStageId) || 999); // Use actual production stage order_index

      const { data: fallbackData, error: fallbackError } = await supabase.rpc('initialize_custom_job_stages', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_stage_ids: stageIds,
        p_stage_orders: stageOrders
      });

      if (fallbackError) {
        logger.addDebugInfo(`❌ Fallback initialization also failed for job ${jobId}: ${fallbackError.message}`);
        return false;
      }

      logger.addDebugInfo(`✅ Successfully initialized workflow for job ${jobId} using fallback method (${stageIds.length} stages)`);
      
      // 🚀 TIMING CALCULATION: Calculate timing estimates for fallback stages
      await calculateTimingForCreatedStages(jobId, sortedMappings, logger);
      
      return true;
    }

    logger.addDebugInfo(`✅ Successfully initialized enhanced workflow for job ${jobId} with specifications (${sortedMappings.length} stages)`);
    
    // 🚀 MULTI-SPECIFICATION: Create sub-tasks for stages with multiple specifications
    await createSubTasksForMultiSpecStages(jobId, stageGroups, logger);
    
    // 🚀 TIMING CALCULATION: Calculate timing estimates for all created stages
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
 * Create sub-tasks for stages with multiple specifications (e.g., multiple handwork operations)
 */
async function createSubTasksForMultiSpecStages(
  jobId: string,
  stageGroups: Map<string, UserApprovedMapping[]>,
  logger: ExcelImportDebugger
): Promise<void> {
  try {
    logger.addDebugInfo(`🔍 Checking for multi-specification stages in job ${jobId}`);
    
    for (const [stageId, mappings] of stageGroups.entries()) {
      // Only create sub-tasks if there are 2+ mappings for the same stage AND they have specifications
      if (mappings.length <= 1 || !mappings.some(m => m.mappedStageSpecId)) {
        continue;
      }
      
      logger.addDebugInfo(`✅ Found multi-spec stage: ${mappings[0].mappedStageName} with ${mappings.length} specifications`);
      
      // Get the stage instance that was created
      const { data: stageInstance, error: fetchError } = await supabase
        .from('job_stage_instances')
        .select('id, production_stage_id')
        .eq('job_id', jobId)
        .eq('production_stage_id', stageId)
        .single();
      
      if (fetchError || !stageInstance) {
        logger.addDebugInfo(`⚠️ Could not find stage instance for ${mappings[0].mappedStageName}`);
        continue;
      }
      
      // Create sub-tasks for each specification
      const subTasksToCreate = mappings
        .filter(m => m.mappedStageSpecId)
        .map((mapping, index) => ({
          stage_instance_id: stageInstance.id,
          stage_specification_id: mapping.mappedStageSpecId!,
          sub_task_order: index + 1,
          quantity: mapping.qty || null,
          status: 'pending'
        }));
      
      if (subTasksToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('stage_sub_tasks' as any)
          .insert(subTasksToCreate);
        
        if (insertError) {
          logger.addDebugInfo(`❌ Failed to create sub-tasks for ${mappings[0].mappedStageName}: ${insertError.message}`);
        } else {
          logger.addDebugInfo(`✅ Created ${subTasksToCreate.length} sub-tasks for ${mappings[0].mappedStageName}`);
        }
      }
    }
  } catch (error) {
    logger.addDebugInfo(`❌ Error creating sub-tasks: ${error}`);
  }
}

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
        // MULTI-SPEC: Check if this stage has sub-tasks
        const { data: subTasks, error: subTaskError } = await supabase
          .from('stage_sub_tasks' as any)
          .select('id, stage_specification_id, quantity')
          .eq('stage_instance_id', stageInstance.id)
          .order('sub_task_order');
        
        if (subTaskError) {
          logger.addDebugInfo(`⚠️ Could not fetch sub-tasks for stage ${stageInstance.id}: ${subTaskError.message}`);
        }
        
        let totalDurationMinutes = 0;
        
        // If sub-tasks exist, sum their durations
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
