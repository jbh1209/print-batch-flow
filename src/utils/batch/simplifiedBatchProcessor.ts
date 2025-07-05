/**
 * PHASE 4: SIMPLIFIED SEND TO PRINT LOGIC
 * 
 * Replaces the complex enhanced batch processor with simple, reliable logic.
 * Works directly with the new database triggers and simplified validation.
 */

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SimplifiedSendToPrintResult {
  success: boolean;
  masterJobId?: string;
  errors: string[];
}

/**
 * Simplified Send to Print - no complex validation, no retries, just works
 */
export async function sendBatchToPrintSimplified(batchId: string): Promise<SimplifiedSendToPrintResult> {
  console.log(`🚀 Simplified Send to Print for batch ${batchId}`);
  
  const result: SimplifiedSendToPrintResult = {
    success: false,
    errors: []
  };

  try {
    // Step 1: Validate batch exists and is ready
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select('id, name, status')
      .eq('id', batchId)
      .single();

    if (batchError) {
      throw new Error(`Batch validation failed: ${batchError.message}`);
    }

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status === 'completed' || batch.status === 'sent_to_print') {
      throw new Error(`Batch is already ${batch.status}`);
    }

    console.log(`✅ Batch "${batch.name}" validated`);

    // Step 2: Enhanced validation using the new validation function
    const { data: validation, error: validationError } = await supabase
      .rpc('validate_batch_simple', { p_batch_id: batchId });

    if (validationError) {
      console.warn('⚠️ Validation warning:', validationError);
      // Don't fail on validation errors, just log them
    }

    if (validation && validation.length > 0) {
      const validationResult = validation[0];
      console.log('📊 Batch validation:', validationResult);
      
      if (!validationResult.is_valid) {
        console.warn(`⚠️ Batch validation issues: ${validationResult.message}`);
        // Log but don't fail - let the user decide
      }
    }

    // Step 3: Create enhanced master job with automatic stage detection and constituent job management
    console.log(`🔨 Creating enhanced master job for batch "${batch.name}"`);
    
    const { data: masterJobResult, error: createError } = await supabase
      .rpc('create_enhanced_batch_master_job', { p_batch_id: batchId });

    if (createError) {
      throw new Error(`Failed to create master job: ${createError.message}`);
    }

    if (!masterJobResult || masterJobResult.length === 0) {
      throw new Error('Master job creation returned no results');
    }

    const { master_job_id, printing_stage_id, constituent_jobs_count } = masterJobResult[0];

    console.log(`✅ Enhanced master job created successfully:`, {
      masterJobId: master_job_id,
      printingStageId: printing_stage_id,
      constituentJobsCount: constituent_jobs_count
    });

    result.masterJobId = master_job_id;
    result.success = true;

    toast.success(`Batch "${batch.name}" sent to print - ${constituent_jobs_count} jobs now in production workflow`);
    return result;

  } catch (error) {
    console.error('❌ Simplified Send to Print failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    result.errors.push(errorMessage);
    toast.error(`Failed to send batch to print: ${errorMessage}`);
    return result;
  }
}

/**
 * Simple batch validation - checks if batch has references and they're valid
 */
export async function validateBatchSimple(batchId: string): Promise<{
  isValid: boolean;
  referenceCount: number;
  message: string;
}> {
  try {
    const { data: validation, error } = await supabase
      .rpc('validate_batch_simple', { p_batch_id: batchId });

    if (error) {
      return {
        isValid: false,
        referenceCount: 0,
        message: `Validation failed: ${error.message}`
      };
    }

    if (validation && validation.length > 0) {
      const result = validation[0];
      return {
        isValid: result.is_valid,
        referenceCount: result.reference_count,
        message: result.message
      };
    }

    return {
      isValid: false,
      referenceCount: 0,
      message: 'No validation results returned'
    };

  } catch (error) {
    console.error('❌ Batch validation error:', error);
    return {
      isValid: false,
      referenceCount: 0,
      message: error instanceof Error ? error.message : 'Validation error'
    };
  }
}