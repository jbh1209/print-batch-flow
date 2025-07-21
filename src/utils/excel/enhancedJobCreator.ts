import { supabase } from "@/integrations/supabase/client";
import type { ExcelImportDebugger } from "@/utils/excel";

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

interface JobData {
  customer: string;
  reference: string;
  category: string;
  priority: string;
  specification: string;
  paper_specifications: string;
  delivery_specifications: string;
  finishing_specifications: string;
  packaging_specifications: string;
  notes: string;
  // Add other job data fields as necessary
}

/**
 * Enhanced Job Creation from Excel Data
 *
 * This function takes parsed Excel data, user-approved stage mappings, and a logger
 * to create jobs in the database, including custom stage specifications and handling
 * of duplicate stage assignments.
 */
export const createJobsFromExcelDataEnhanced = async (
  excelData: any[],
  userApprovedMappings: UserApprovedMapping[],
  logger: ExcelImportDebugger
): Promise<boolean> => {
  logger.addDebugInfo(`Starting enhanced job creation from Excel data with ${excelData.length} rows`);

  if (!excelData || excelData.length === 0) {
    logger.addDebugInfo(`No Excel data provided, skipping job creation`);
    return false;
  }

  if (!userApprovedMappings || userApprovedMappings.length === 0) {
    logger.addDebugInfo(`No user-approved mappings provided, skipping enhanced job creation`);
    return false;
  }

  try {
    // Prepare a map for quick lookup of stage specifications
    const stageSpecMap = new Map<string, string>();
    userApprovedMappings.forEach(mapping => {
      if (mapping.mappedStageId && mapping.mappedStageSpecId) {
        stageSpecMap.set(mapping.mappedStageId, mapping.mappedStageSpecId);
      }
    });

    // Prepare a map for quantity assignments
    const stageQuantityMap = new Map<string, number>();

    // Function to create a job and its stages
    const createJob = async (jobData: JobData): Promise<string | null> => {
      logger.addDebugInfo(`Creating job for customer: ${jobData.customer}, reference: ${jobData.reference}`);

      // Insert job data into the production_jobs table
      const { data: jobDataResult, error: jobDataError } = await supabase
        .from('production_jobs')
        .insert([
          {
            customer: jobData.customer,
            reference: jobData.reference,
            category_id: jobData.category,
            priority: jobData.priority,
            specification: jobData.specification,
            paper_specifications: jobData.paper_specifications,
            delivery_specifications: jobData.delivery_specifications,
            finishing_specifications: jobData.finishing_specifications,
            packaging_specifications: jobData.packaging_specifications,
            notes: jobData.notes,
            // Add other job data fields as necessary
          }
        ])
        .select('id') // Select the ID of the newly inserted job
        .single();

      if (jobDataError) {
        logger.addDebugInfo(`Error inserting job data: ${jobDataError.message}`);
        return null;
      }

      const jobId = jobDataResult.id;
      logger.addDebugInfo(`Job created with ID: ${jobId}`);
      return jobId;
    };

    // Function to create job stage instances
    const createJobStageInstances = async (jobId: string): Promise<boolean> => {
      logger.addDebugInfo(`Creating stage instances for job ID: ${jobId}`);

      // First, get the correct stage order from production_stages table
      const { data: stageOrderData, error: stageOrderError } = await supabase
        .from('production_stages')
        .select('id, order_index')
        .in('id', userApprovedMappings.map(m => m.mappedStageId));

      if (stageOrderError) {
        logger.addDebugInfo(`Failed to fetch stage ordering: ${stageOrderError.message}`);
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

      // Track stage ID usage to handle duplicates by appending suffixes
      const stageIdCounts = new Map<string, number>();

      // Prepare stage mappings data for the database function
      const stageMappingsData = sortedMappings.map((mapping) => {
        // Check if this stage ID has been used before
        const currentCount = stageIdCounts.get(mapping.mappedStageId) || 0;
        stageIdCounts.set(mapping.mappedStageId, currentCount + 1);

        // If this is the 2nd+ occurrence, append suffix for uniqueness
        let uniqueStageId = mapping.mappedStageId;
        if (currentCount > 0) {
          uniqueStageId = `${mapping.mappedStageId}-${currentCount + 1}`;
        }

        return {
          stage_id: mapping.mappedStageId, // Keep original for production_stage_id reference
          unique_stage_id: uniqueStageId, // For uniqueness tracking
          stage_order: stageOrderMap.get(mapping.mappedStageId) || 999, // Use actual production stage order_index
          stage_specification_id: mapping.mappedStageSpecId || null,
          part_name: mapping.partType || null,
          quantity: mapping.qty || null,
          paper_specification: mapping.paperSpecification || null
        };
      });

      // Call the database function to initialize custom job stages with specifications
      const { data, error } = await supabase.rpc('initialize_custom_job_stages_with_specs', {
        p_job_id: jobId,
        p_job_table_name: 'production_jobs',
        p_stage_mappings: stageMappingsData
      });

      if (error) {
        logger.addDebugInfo(`Failed to initialize custom workflow with specs: ${error.message}`);
        return false;
      }

      logger.addDebugInfo(`Successfully initialized enhanced workflow with specifications for job ${jobId}`);
      return true;
    };

    // Process each row of Excel data
    for (const row of excelData) {
      // Map Excel row data to the JobData interface
      const jobData: JobData = {
        customer: row.customer || 'Unknown Customer', // Example: map 'customer' column
        reference: row.reference || 'No Reference',   // Example: map 'reference' column
        category: row.category || 'default_category_id', // Ensure a default category is provided
        priority: row.priority || 'Normal',
        specification: row.specification || 'No Specification',
        paper_specifications: row.paper_specifications || 'No Paper Specs',
        delivery_specifications: row.delivery_specifications || 'No Delivery Specs',
        finishing_specifications: row.finishing_specifications || 'No Finishing Specs',
        packaging_specifications: row.packaging_specifications || 'No Packaging Specs',
        notes: row.notes || 'No Notes',
        // Map other columns as necessary
      };

      // Create the job and get the job ID
      const jobId = await createJob(jobData);
      if (!jobId) {
        logger.addDebugInfo(`Failed to create job for customer: ${jobData.customer}, reference: ${jobData.reference}`);
        continue; // Skip to the next row if job creation fails
      }

      // Create job stage instances for the created job
      const stagesCreated = await createJobStageInstances(jobId);
      if (!stagesCreated) {
        logger.addDebugInfo(`Failed to create stage instances for job ID: ${jobId}`);
        continue; // Skip to the next row if stage creation fails
      }
    }

    logger.addDebugInfo(`Enhanced job creation process completed`);
    return true;

  } catch (error) {
    logger.addDebugInfo(`Error in enhanced job creation process: ${error}`);
    return false;
  }

  // Update job stage instances with extracted quantities
  for (const mapping of userApprovedMappings) {
    const quantity = mapping.qty;
    if (quantity && quantity > 0) {
      logger.addDebugInfo(`✅ Set quantity ${quantity} for stage ${mapping.mappedStageId} (${mapping.mappedStageName})`);
      
      // Track stage ID usage to handle duplicates with suffixes
      const stageIdCounts = new Map<string, number>();
      
      // Generate unique stage ID the same way as in jobWorkflowInitializer
      const currentCount = stageIdCounts.get(mapping.mappedStageId) || 0;
      stageIdCounts.set(mapping.mappedStageId, currentCount + 1);
      
      let uniqueStageId = mapping.mappedStageId;
      if (currentCount > 0) {
        uniqueStageId = `${mapping.mappedStageId}-${currentCount + 1}`;
      }
      
      // Use the unique stage ID for quantity assignment
      stageQuantityMap.set(uniqueStageId, quantity);
    }
  }
};
