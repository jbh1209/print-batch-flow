import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Enhanced Batch Processor - Comprehensive batch job management
 * Works with database triggers for automatic reference creation
 */

interface ProcessBatchJobsParams {
  jobIds: string[];
  batchId: string;
  tableName: string;
}

interface BatchJobsProcessResult {
  success: boolean;
  linkedCount: number;
  unlinkedCount: number;
  errors: string[];
}

interface BatchValidationResult {
  isValid: boolean;
  missingReferences: number;
  errors: string[];
}

/**
 * Process batch jobs with comprehensive error handling and validation
 */
export async function processBatchJobsEnhanced({
  jobIds,
  batchId,
  tableName
}: ProcessBatchJobsParams): Promise<BatchJobsProcessResult> {
  console.log(`🔄 Enhanced batch processing: ${jobIds.length} jobs for batch ${batchId} in table ${tableName}`);
  
  if (jobIds.length === 0) {
    return { 
      success: false,
      linkedCount: 0,
      unlinkedCount: 0,
      errors: ['No jobs provided for batch processing']
    };
  }

  const result: BatchJobsProcessResult = {
    success: false,
    linkedCount: 0,
    unlinkedCount: 0,
    errors: []
  };

  try {
    // Step 1: Validate batch exists
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name, status')
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      throw new Error(`Batch validation failed: ${batchError?.message || 'Batch not found'}`);
    }

    if (batch.status === 'completed' || batch.status === 'cancelled') {
      throw new Error(`Cannot process jobs for ${batch.status} batch`);
    }

    // Step 2: Update jobs with batch_id (triggers will handle reference creation)
    console.log(`🔄 Linking ${jobIds.length} jobs to batch ${batch.name}`);
    
    const { data: updatedJobs, error: updateError } = await supabase
      .from(tableName as any)
      .update({
        batch_id: batchId,
        status: 'batched',
        batch_allocated_at: new Date().toISOString(),
        batch_allocated_by: (await supabase.auth.getUser()).data.user?.id
      })
      .in('id', jobIds)
      .select('id, job_number');

    if (updateError) {
      throw new Error(`Failed to link jobs to batch: ${updateError.message}`);
    }

    const actualLinkedCount = updatedJobs?.length || 0;
    result.linkedCount = actualLinkedCount;
    result.unlinkedCount = jobIds.length - actualLinkedCount;

    console.log(`✅ Successfully linked ${actualLinkedCount}/${jobIds.length} jobs to batch`);

    // Step 3: Validate that batch job references were created by triggers
    await new Promise(resolve => setTimeout(resolve, 1000)); // Give triggers time to execute
    
    const validationResult = await validateBatchReferences(batchId);
    
    if (!validationResult.isValid && validationResult.missingReferences > 0) {
      console.warn(`⚠️ ${validationResult.missingReferences} batch references missing, attempting repair...`);
      
      // Attempt to repair missing references
      const repairResult = await repairBatchReferences(batchId);
      if (repairResult.success) {
        console.log(`✅ Repaired ${repairResult.referencesCreated} missing batch references`);
      } else {
        result.errors.push(`Failed to repair ${validationResult.missingReferences} missing references`);
      }
    }

    // Step 4: Final validation
    const finalValidation = await validateBatchReferences(batchId);
    result.success = finalValidation.isValid;
    
    if (!result.success) {
      result.errors.push(...finalValidation.errors);
      toast.error(`Batch processing incomplete: ${finalValidation.errors.join(', ')}`);
    } else {
      toast.success(`Successfully processed ${result.linkedCount} jobs for batch`);
    }

    return result;

  } catch (error) {
    console.error('❌ Enhanced batch processing failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);
    result.unlinkedCount = jobIds.length;
    toast.error(`Batch processing failed: ${errorMessage}`);
    return result;
  }
}

/**
 * Validate that all batch job references exist for a batch
 */
async function validateBatchReferences(batchId: string): Promise<BatchValidationResult> {
  try {
    console.log(`🔍 Validating batch references for batch ${batchId}`);
    
    const { data: validationResult, error } = await supabase
      .rpc('validate_batch_simple', { p_batch_id: batchId });

    if (error) {
      return {
        isValid: false,
        missingReferences: 0,
        errors: [`Validation failed: ${error.message}`]
      };
    }

    const result = validationResult?.[0];
    
    return {
      isValid: result?.is_valid || false,
      missingReferences: result?.missing_jobs || 0,
      errors: result?.is_valid ? [] : [result?.message || 'Unknown validation error']
    };

  } catch (error) {
    console.error('❌ Batch validation error:', error);
    return {
      isValid: false,
      missingReferences: 0,
      errors: [error instanceof Error ? error.message : 'Validation error']
    };
  }
}

/**
 * Repair missing batch job references
 */
async function repairBatchReferences(batchId: string): Promise<{ success: boolean; referencesCreated: number }> {
  try {
    console.log(`🔧 Repairing batch references for batch ${batchId}`);
    
    const { data: validationResult, error } = await supabase
      .rpc('validate_batch_simple', { p_batch_id: batchId });

    if (error) {
      console.error('❌ Validation failed:', error);
      return { success: false, referencesCreated: 0 };
    }

    const result = validationResult?.[0];
    const referenceCount = result?.reference_count || 0;
    
    console.log(`✅ Validation completed: ${referenceCount} references found`);
    
    return {
      success: result?.is_valid || false,
      referencesCreated: 0 // This function now validates instead of repairing
    };

  } catch (error) {
    console.error('❌ Repair error:', error);
    return { success: false, referencesCreated: 0 };
  }
}

/**
 * Enhanced batch completion with comprehensive error handling
 */
export async function completeBatchProcessingEnhanced(
  batchId: string, 
  nextStageId?: string
): Promise<{ success: boolean; errors: string[] }> {
  console.log(`🔄 Enhanced batch completion for batch ${batchId}`);
  
  const result = { success: false, errors: [] as string[] };

  try {
    // Step 1: Get batch job references with validation
    const { data: batchRefs, error: fetchError } = await supabase
      .from('batch_job_references')
      .select(`
        production_job_id,
        batch_job_id,
        batch_job_table,
        status
      `)
      .eq('batch_id', batchId);

    if (fetchError) {
      throw new Error(`Failed to fetch batch references: ${fetchError.message}`);
    }

    if (!batchRefs || batchRefs.length === 0) {
      throw new Error('No batch job references found for completion');
    }

    console.log(`📋 Processing ${batchRefs.length} batch job references for completion`);

    // Step 2: Update production jobs status
    const productionJobIds = batchRefs.map(ref => ref.production_job_id);
    
    const { error: jobUpdateError } = await supabase
      .from('production_jobs')
      .update({
        status: nextStageId ? 'Ready to Print' : 'Batch Complete',
        updated_at: new Date().toISOString(),
        batch_ready: false
      })
      .in('id', productionJobIds);

    if (jobUpdateError) {
      result.errors.push(`Failed to update production jobs: ${jobUpdateError.message}`);
    }

    // Step 3: Update batch job references status
    const { error: refsUpdateError } = await supabase
      .from('batch_job_references')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('batch_id', batchId);

    if (refsUpdateError) {
      result.errors.push(`Failed to update batch references: ${refsUpdateError.message}`);
    }

    // Step 4: Activate next stage if specified
    if (nextStageId && productionJobIds.length > 0) {
      const { error: stageError } = await supabase
        .from('job_stage_instances')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          notes: 'Advanced from batch processing to next stage'
        })
        .in('job_id', productionJobIds)
        .eq('job_table_name', 'production_jobs')
        .eq('production_stage_id', nextStageId)
        .eq('status', 'pending');

      if (stageError) {
        result.errors.push(`Failed to activate next stage: ${stageError.message}`);
      }
    }

    result.success = result.errors.length === 0;
    
    if (result.success) {
      console.log(`✅ Enhanced batch completion successful for ${productionJobIds.length} jobs`);
      toast.success(`Batch processing completed for ${productionJobIds.length} jobs`);
    } else {
      console.error(`❌ Enhanced batch completion had errors:`, result.errors);
      toast.error(`Batch completion completed with ${result.errors.length} errors`);
    }

    return result;

  } catch (error) {
    console.error('❌ Enhanced batch completion failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    result.errors.push(errorMessage);
    toast.error(`Batch completion failed: ${errorMessage}`);
    return result;
  }
}

/**
 * Enhanced Send to Print functionality with comprehensive validation and debugging
 */
export async function sendBatchToPrintEnhanced(batchId: string): Promise<{ success: boolean; masterJobId?: string; errors: string[] }> {
  console.log(`🚀 Enhanced Send to Print for batch ${batchId}`);
  
  const result: { success: boolean; masterJobId?: string; errors: string[] } = { 
    success: false, 
    errors: [] 
  };

  try {
    // Step 1: Pre-validation integrity check
    console.log(`🔍 Running batch integrity validation for ${batchId}...`);
    
    const { data: integrityResult, error: integrityError } = await supabase
      .rpc('validate_batch_integrity', { p_batch_id: batchId });

    if (integrityError) {
      console.warn('⚠️ Integrity check failed:', integrityError);
    } else if (integrityResult && integrityResult.length > 0) {
      const integrity = integrityResult[0];
      console.log('📊 Integrity check results:', integrity);
      
      if (!integrity.is_valid) {
        console.warn('⚠️ Batch integrity issues detected:', integrity.issues);
        // Continue but log the issues for debugging
      }
    }

    // Step 2: Comprehensive batch validation
    console.log(`🔍 Validating batch ${batchId}...`);
    
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name, status')
      .eq('id', batchId)
      .single();

    if (batchError) {
      console.error('❌ Batch query error:', batchError);
      throw new Error(`Batch validation failed: ${batchError.message}`);
    }

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'completed') {
      throw new Error('Batch is already completed');
    }

    console.log(`✅ Batch "${batch.name}" validated successfully`);

    // Step 3: Validate batch job references with retry logic
    console.log(`📋 Fetching batch job references for batch ${batchId}...`);
    
    let batchRefs;
    let refsError;
    
    // Retry logic for batch references (sometimes there's a timing issue)
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔄 Attempt ${attempt} to fetch batch references...`);
      
      const { data, error } = await supabase
        .from('batch_job_references')
        .select('production_job_id, batch_job_id, batch_job_table, status')
        .eq('batch_id', batchId);

      batchRefs = data;
      refsError = error;
      
      if (!error && data && data.length > 0) {
        console.log(`✅ Found ${data.length} batch references on attempt ${attempt}`);
        break;
      }
      
      console.warn(`⚠️ Attempt ${attempt} failed:`, error?.message || 'No references found');
      
      if (attempt < 3) {
        console.log('⏳ Waiting 1 second before retry...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (refsError) {
      console.error('❌ Batch references query error:', refsError);
      throw new Error(`Failed to fetch batch references: ${refsError.message}`);
    }

    if (!batchRefs || batchRefs.length === 0) {
      console.error('❌ No batch job references found after retries');
      
      // Try to validate batch references
      console.log('🔍 Attempting to validate existing batch references...');
      
      const { data: validationResult, error: validationError } = await supabase
        .rpc('validate_batch_simple', { p_batch_id: batchId });
        
      if (validationError) {
        console.error('❌ Validation attempt failed:', validationError);
        throw new Error(`No constituent jobs found for batch and validation failed: ${validationError.message}`);
      }
      
      if (validationResult && validationResult.length > 0 && validationResult[0].reference_count > 0) {
        console.log(`✅ Found ${validationResult[0].reference_count} existing references`);
        
        // Try fetching again after repair
        const { data: repairedRefs, error: repairedError } = await supabase
          .from('batch_job_references')
          .select('production_job_id, batch_job_id, batch_job_table, status')
          .eq('batch_id', batchId);
          
        if (!repairedError && repairedRefs && repairedRefs.length > 0) {
          batchRefs = repairedRefs;
          console.log(`✅ Successfully retrieved ${repairedRefs.length} references after repair`);
        } else {
          throw new Error('Failed to retrieve batch references even after repair');
        }
      } else {
        throw new Error('No constituent jobs found for batch - cannot send to print');
      }
    }

    console.log(`📋 Found ${batchRefs.length} constituent jobs for batch master creation`);

    // Step 4: Validate that all production jobs exist
    const constituentJobIds = batchRefs.map(ref => ref.production_job_id);
    
    console.log(`🔍 Validating ${constituentJobIds.length} production jobs...`);
    
    const { data: productionJobs, error: jobsError } = await supabase
      .from('production_jobs')
      .select('id, wo_no, customer, status')
      .in('id', constituentJobIds);

    if (jobsError) {
      console.error('❌ Production jobs query error:', jobsError);
      throw new Error(`Failed to validate production jobs: ${jobsError.message}`);
    }

    if (!productionJobs || productionJobs.length !== constituentJobIds.length) {
      console.error(`❌ Production job count mismatch. Expected: ${constituentJobIds.length}, Found: ${productionJobs?.length || 0}`);
      
      // Log which jobs are missing
      if (productionJobs) {
        const foundIds = productionJobs.map(job => job.id);
        const missingIds = constituentJobIds.filter(id => !foundIds.includes(id));
        console.error('❌ Missing production job IDs:', missingIds);
      }
      
      throw new Error(`Production job validation failed. Expected ${constituentJobIds.length}, found ${productionJobs?.length || 0}`);
    }

    console.log(`✅ All ${productionJobs.length} production jobs validated successfully`);
    console.log('📊 Production jobs summary:', productionJobs.map(job => ({ wo_no: job.wo_no, customer: job.customer, status: job.status })));

    // Step 5: Create batch master job using database function
    console.log(`🔨 Creating batch master job for batch ${batch.name}...`);
    console.log('📋 Constituent job IDs:', constituentJobIds);
    
    const { data: masterJobId, error: createError } = await supabase
      .rpc('create_batch_master_job', {
        p_batch_id: batchId,
        p_constituent_job_ids: constituentJobIds
      });

    if (createError) {
      console.error('❌ Database function error:', createError);
      console.error('❌ Function details:', { batchId, constituentJobIds });
      throw new Error(`Failed to create batch master job: ${createError.message}`);
    }

    if (!masterJobId) {
      console.error('❌ Master job creation returned null');
      throw new Error('Batch master job creation returned null');
    }

    console.log(`✅ Batch master job created successfully: ${masterJobId}`);
    result.masterJobId = masterJobId;

    // Step 6: Update batch status to completed
    console.log(`📝 Updating batch status to completed...`);
    
    const { error: statusError } = await supabase
      .from('batches')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId);

    if (statusError) {
      console.error('❌ Batch status update error:', statusError);
      throw new Error(`Failed to complete batch: ${statusError.message}`);
    }

    console.log(`✅ Batch status updated to completed`);

    // Step 7: Trigger reverse sync to update production jobs
    console.log(`🔄 Syncing production jobs...`);
    
    const { error: syncError } = await supabase.rpc('sync_production_jobs_from_batch_completion');
    
    if (syncError) {
      console.warn('⚠️ Reverse sync warning:', syncError);
      result.errors.push(`Sync warning: ${syncError.message}`);
    } else {
      console.log('✅ Production jobs sync completed successfully');
    }

    result.success = true;
    console.log(`🎉 Enhanced Send to Print completed successfully for batch "${batch.name}" with master job ${masterJobId}`);
    toast.success(`Batch "${batch.name}" sent to print successfully`);
    
    return result;

  } catch (error) {
    console.error('❌ Enhanced Send to Print failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    result.errors.push(errorMessage);
    toast.error(`Failed to send batch to print: ${errorMessage}`);
    return result;
  }
}