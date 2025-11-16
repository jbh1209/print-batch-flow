import { supabase } from '@/integrations/supabase/client';
import { PaperSpecificationSaver } from '@/services/PaperSpecificationSaver';

/**
 * Backfill paper specifications for production jobs that have specs in JSONB
 * but not in the job_print_specifications table
 */
export async function backfillPaperSpecifications() {
  const results = {
    total: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
    unmapped: 0,
    unmappedKeys: [] as string[],
    errors: [] as Array<{ jobId: string; woNo: string; error: string }>
  };

  try {
    console.log('🔍 Fetching production jobs with paper specifications...');

    // Fetch all production jobs that have paper_specifications JSONB data
    const { data: jobs, error: fetchError } = await supabase
      .from('production_jobs')
      .select('id, wo_no, paper_specifications')
      .not('paper_specifications', 'is', null);

    if (fetchError) {
      console.error('Error fetching jobs:', fetchError);
      throw fetchError;
    }

    if (!jobs || jobs.length === 0) {
      console.log('No jobs found with paper specifications');
      return results;
    }

    results.total = jobs.length;
    console.log(`Found ${jobs.length} jobs with paper specifications`);

    const paperSaver = new PaperSpecificationSaver();

    // Process each job
    for (const job of jobs) {
      try {
        // Check if job already has entries in job_print_specifications
        const { data: existing } = await supabase
          .from('job_print_specifications')
          .select('specification_category')
          .eq('job_id', job.id)
          .eq('job_table_name', 'production_jobs')
          .in('specification_category', ['paper_type', 'paper_weight']);

        if (existing && existing.length > 0) {
          console.log(`⏭️  Skipping job ${job.wo_no} - already has paper specs in table`);
          results.skipped++;
          continue;
        }

        // Extract paper specifications from JSONB and look up mappings
        const paperSpecs = job.paper_specifications as any;
        
        if (!paperSpecs || typeof paperSpecs !== 'object') {
          console.log(`⏭️  Skipping job ${job.wo_no} - no paper specifications`);
          results.skipped++;
          continue;
        }

        const paperKeys = Object.keys(paperSpecs);
        if (paperKeys.length === 0) {
          console.log(`⏭️  Skipping job ${job.wo_no} - empty paper specifications`);
          results.skipped++;
          continue;
        }

        console.log(`📋 Processing job ${job.wo_no} with ${paperKeys.length} paper key(s)`);

        let anySuccess = false;

        // Process each paper key (could be multiple for cover/text)
        for (const paperKey of paperKeys) {
          let paperType: string | undefined;
          let paperWeight: string | undefined;
          let usedMapping = false;

          // Try to find mapping in excel_import_mappings
          const { data: mapping } = await supabase
            .from('excel_import_mappings')
            .select(`
              excel_text,
              paper_type:print_specifications!paper_type_specification_id(id, display_name),
              paper_weight:print_specifications!paper_weight_specification_id(id, display_name)
            `)
            .eq('excel_text', paperKey)
            .maybeSingle();

          if (mapping?.paper_type && mapping?.paper_weight) {
            // Use mapped specifications
            paperType = mapping.paper_type.display_name;
            paperWeight = mapping.paper_weight.display_name;
            usedMapping = true;
            console.log(`  ✓ Mapped "${paperKey}" → "${paperType} ${paperWeight}"`);
          } else {
            // Fallback: extract from raw key
            const parts = paperKey.split(',').map(p => p.trim());
            if (parts.length >= 2 && parts[1].toLowerCase().includes('gsm')) {
              paperType = parts[0];
              paperWeight = parts[1];
              console.log(`  ⚠ No mapping found for "${paperKey}", using fallback: "${paperType} ${paperWeight}"`);
              
              if (!results.unmappedKeys.includes(paperKey)) {
                results.unmappedKeys.push(paperKey);
                results.unmapped++;
              }
            } else {
              console.log(`  ✗ Could not parse "${paperKey}"`);
              continue;
            }
          }

          if (paperType && paperWeight) {
            const success = await paperSaver.savePaperSpecifications(
              job.id,
              'production_jobs',
              paperType,
              paperWeight
            );

            if (success) {
              anySuccess = true;
            }
          }
        }

        if (anySuccess) {
          console.log(`✅ Successfully backfilled job ${job.wo_no}`);
          results.processed++;
        } else {
          console.log(`⚠️  Could not resolve any specs for job ${job.wo_no}`);
          results.skipped++;
        }

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing job ${job.wo_no}:`, errorMessage);
        results.failed++;
        results.errors.push({
          jobId: job.id,
          woNo: job.wo_no,
          error: errorMessage
        });
      }
    }

    console.log('\n📊 Backfill Summary:');
    console.log(`Total jobs: ${results.total}`);
    console.log(`Processed: ${results.processed}`);
    console.log(`Skipped: ${results.skipped}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Unmapped keys: ${results.unmapped}`);

    if (results.unmappedKeys.length > 0) {
      console.log('\n⚠️  Unmapped Paper Keys (need manual mapping):');
      results.unmappedKeys.forEach(key => {
        console.log(`  - "${key}"`);
      });
    }

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(e => {
        console.log(`  - ${e.woNo}: ${e.error}`);
      });
    }

    return results;
  } catch (error) {
    console.error('Fatal error during backfill:', error);
    throw error;
  }
}

/**
 * Run backfill from browser console or debug utility
 * Usage: import and call this function from a component or console
 */
export async function runBackfillNow() {
  console.log('🚀 Starting paper specification backfill...');
  const results = await backfillPaperSpecifications();
  console.log('✅ Backfill complete!');
  return results;
}
