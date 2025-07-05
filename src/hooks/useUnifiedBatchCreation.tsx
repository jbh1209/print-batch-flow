/**
 * PHASE 2: UNIFIED BATCH CREATION SYSTEM
 * 
 * This replaces ALL existing batch creation hooks with a single, reliable system.
 * Works with database triggers to automatically create batch job references.
 * 
 * REPLACES:
 * - useBatchCreation.tsx
 * - src/hooks/generic/batch-operations/useBatchCreation.tsx
 * - All product-specific batch creation logic
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { addBusinessDays } from "date-fns";

interface UnifiedBatchJob {
  id: string;
  quantity: number;
  due_date: string;
  [key: string]: any;
}

interface UnifiedBatchConfig {
  productType: string;
  tableName: string;
  laminationType?: string;
  paperType?: string;
  paperWeight?: string;
  slaTargetDays?: number;
}

export function useUnifiedBatchCreation() {
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const { user } = useAuth();

  const generateBatchName = async (productType: string): Promise<string> => {
    const typeCode = getProductTypeCode(productType);
    
    try {
      const { data, error } = await supabase
        .from("batches")
        .select("name")
        .ilike("name", `DXB-${typeCode}-%`)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      let nextNumber = 1;
      if (data && data.length > 0) {
        const match = data[0].name.match(/DXB-[A-Z]+-(\d+)/);
        nextNumber = match ? parseInt(match[1], 10) + 1 : 1;
      }
      
      return `DXB-${typeCode}-${nextNumber.toString().padStart(5, '0')}`;
    } catch (err) {
      console.error("Error generating batch name:", err);
      return `DXB-${typeCode}-${Date.now().toString().substr(-5)}`;
    }
  };

  const createBatch = async (
    selectedJobs: UnifiedBatchJob[],
    config: UnifiedBatchConfig,
    customBatchName?: string
  ) => {
    if (!user) {
      toast.error("You must be logged in to create batches");
      return null;
    }

    if (selectedJobs.length === 0) {
      toast.error("No jobs selected for batch creation");
      return null;
    }

    setIsCreatingBatch(true);
    
    try {
      console.log(`🔄 Creating unified batch for ${config.productType} with ${selectedJobs.length} jobs`);
      
      // Pre-validate that all jobs have matching production jobs
      const validationResults = await validateJobsHaveProductionMatches(selectedJobs);
      const invalidJobs = validationResults.filter(result => !result.hasMatch);
      
      if (invalidJobs.length > 0) {
        const jobNumbers = invalidJobs.map(job => job.jobNumber).join(', ');
        throw new Error(`Cannot create batch: Jobs ${jobNumbers} have no matching production jobs. Please ensure these jobs exist in the tracker system.`);
      }
      
      // Calculate batch properties
      const totalQuantity = selectedJobs.reduce((sum, job) => sum + job.quantity, 0);
      const sheetsRequired = calculateSheetsRequired(totalQuantity, config.productType);
      const batchName = customBatchName || await generateBatchName(config.productType);
      
      // Calculate batch due date (today + SLA days)
      const slaTargetDays = config.slaTargetDays || 3;
      const batchDueDate = addBusinessDays(new Date(), slaTargetDays);
      
      console.log(`📝 Batch details:`, {
        name: batchName,
        sheetsRequired,
        dueDate: batchDueDate.toISOString(),
        slaTargetDays
      });
      
      // Step 1: Create batch record
      const { data: batch, error: batchError } = await supabase
        .from("batches")
        .insert({
          name: batchName,
          status: 'pending' as any,
          lamination_type: (config.laminationType || 'none') as any,
          sheets_required: sheetsRequired,
          due_date: batchDueDate.toISOString(),
          paper_type: config.paperType,
          paper_weight: config.paperWeight,
          sla_target_days: slaTargetDays,
          created_by: user.id
        })
        .select()
        .single();
        
      if (batchError) {
        console.error("❌ Error creating batch:", batchError);
        throw new Error(`Failed to create batch: ${batchError.message}`);
      }
      
      if (!batch) {
        throw new Error("Failed to create batch: No data returned");
      }
      
      console.log(`✅ Batch created successfully:`, batch);
      
      // Step 2: Update jobs with batch_id (triggers will create references automatically)
      const jobIds = selectedJobs.map(job => job.id);
      
      console.log(`🔗 Linking ${jobIds.length} jobs to batch ${batch.id}`);
      
      const { error: updateError } = await supabase
        .from(config.tableName as any)
        .update({
          batch_id: batch.id,
          status: 'batched',
          batch_allocated_at: new Date().toISOString(),
          batch_allocated_by: user.id
        })
        .in('id', jobIds);
        
      if (updateError) {
        console.error("❌ Error updating jobs:", updateError);
        
        // Rollback: delete the batch
        await supabase.from("batches").delete().eq("id", batch.id);
        throw new Error(`Failed to link jobs to batch: ${updateError.message}`);
      }
      
      console.log(`✅ Successfully linked ${jobIds.length} jobs to batch`);
      
      // Step 3: Verify batch references were created by triggers
      await new Promise(resolve => setTimeout(resolve, 1000)); // Give triggers more time to execute
      
      const { data: references, error: refError } = await supabase
        .from("batch_job_references")
        .select("id")
        .eq("batch_id", batch.id);
        
      if (refError) {
        console.warn("⚠️ Could not verify batch references:", refError);
        toast.warning("Batch created but reference verification failed. Check batch diagnostics.");
      } else {
        const refCount = references?.length || 0;
        console.log(`📋 Verification: ${refCount} batch references created`);
        
        if (refCount !== jobIds.length) {
          console.warn(`⚠️ Reference count mismatch: expected ${jobIds.length}, got ${refCount}`);
          toast.warning(`Batch created but some job references may be missing (${refCount}/${jobIds.length}). Check batch diagnostics.`);
        } else {
          toast.success(`Batch "${batchName}" created successfully with ${selectedJobs.length} jobs`);
        }
      }
      
      return batch;
      
    } catch (error) {
      console.error("❌ Unified batch creation failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Failed to create batch: ${errorMessage}`);
      return null;
    } finally {
      setIsCreatingBatch(false);
    }
  };

  // Validate that selected jobs have matching production jobs
  const validateJobsHaveProductionMatches = async (jobs: UnifiedBatchJob[]): Promise<Array<{jobNumber: string, hasMatch: boolean}>> => {
    try {
      const { data, error } = await supabase.rpc('validate_batch_job_references');
      
      if (error) {
        console.error('Error validating job matches:', error);
        // Return all as valid if we can't check - let the trigger handle it
        return jobs.map(job => ({ jobNumber: job.job_number || job.id, hasMatch: true }));
      }
      
      return jobs.map(job => {
        const jobNumber = job.job_number || job.wo_no || job.id;
        const hasMatch = data?.some(row => row.job_number === jobNumber && row.has_production_job) || false;
        return { jobNumber, hasMatch };
      });
    } catch (error) {
      console.error('Error in job validation:', error);
      // Return all as valid if validation fails - let the system handle it
      return jobs.map(job => ({ jobNumber: job.job_number || job.id, hasMatch: true }));
    }
  };

  return {
    createBatch,
    isCreatingBatch,
    generateBatchName
  };
}

// Helper functions
function getProductTypeCode(productType: string): string {
  const codes: Record<string, string> = {
    "business_cards": "BC",
    "flyers": "FL", 
    "postcards": "PC",
    "sleeves": "SL",
    "boxes": "PB",
    "covers": "COV",
    "posters": "POS",
    "stickers": "STK"
  };
  
  return codes[productType] || "BC";
}

function calculateSheetsRequired(totalQuantity: number, productType: string): number {
  // Default items per sheet for different product types
  const itemsPerSheet: Record<string, number> = {
    "business_cards": 24,  // 3x8 layout
    "flyers": 4,          // 2x2 layout
    "postcards": 8,       // 2x4 layout
    "sleeves": 6,         // 2x3 layout
    "boxes": 2,           // 1x2 layout
    "covers": 4,          // 2x2 layout
    "posters": 1,         // 1x1 layout
    "stickers": 12        // 3x4 layout
  };
  
  const perSheet = itemsPerSheet[productType] || 1;
  return Math.ceil(totalQuantity / perSheet);
}