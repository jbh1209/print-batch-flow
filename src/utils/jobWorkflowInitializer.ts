import { supabase } from "@/integrations/supabase/client";
import type { ExcelImportDebugger } from "@/utils/excel";

interface UserApprovedMapping {
  groupName: string;
  mappedStageId: string;
  mappedStageName: string;
  category: string;
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
    // Extract unique stage IDs and create stage orders
    const stageIds = userApprovedMappings.map(mapping => mapping.mappedStageId);
    const stageOrders = userApprovedMappings.map((_, index) => index + 1);

    logger.addDebugInfo(`📋 Stage workflow for job ${jobId}:`);
    userApprovedMappings.forEach((mapping, index) => {
      logger.addDebugInfo(`   ${index + 1}. ${mapping.mappedStageName} (${mapping.mappedStageId}) - Category: ${mapping.category}`);
    });

    // Use the existing initialize_custom_job_stages database function
    const { data, error } = await supabase.rpc('initialize_custom_job_stages', {
      p_job_id: jobId,
      p_job_table_name: 'production_jobs',
      p_stage_ids: stageIds,
      p_stage_orders: stageOrders
    });

    if (error) {
      logger.addDebugInfo(`❌ Failed to initialize custom workflow for job ${jobId}: ${error.message}`);
      return false;
    }

    logger.addDebugInfo(`✅ Successfully initialized custom workflow for job ${jobId} with ${stageIds.length} stages`);
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