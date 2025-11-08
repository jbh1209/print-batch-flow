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

        // Extract paper type and weight from JSONB keys
        // Format: "FBB Board, 300gsm, White, 480x750"
        const paperSpecs = job.paper_specifications as any;
        let paperType: string | undefined;
        let paperWeight: string | undefined;

        if (paperSpecs && typeof paperSpecs === 'object') {
          const paperKeys = Object.keys(paperSpecs);
          
          // Find the first paper spec key that contains "gsm" (weight indicator)
          const primaryPaperKey = paperKeys.find(key => 
            key.toLowerCase().includes('gsm')
          );
          
          if (primaryPaperKey) {
            // Parse format: "Type, Weight, Color, Size"
            const parts = primaryPaperKey.split(',').map(p => p.trim());
            
            if (parts.length >= 2) {
              paperType = parts[0]; // e.g., "FBB Board", "Bond"
              paperWeight = parts[1]; // e.g., "300gsm", "80gsm"
            }
          }
        }

        if (!paperType && !paperWeight) {
          console.log(`⏭️  Skipping job ${job.wo_no} - no parsed paper data`);
          results.skipped++;
          continue;
        }

        console.log(`📋 Processing job ${job.wo_no}: type="${paperType}", weight="${paperWeight}"`);

        // Save paper specifications
        const success = await paperSaver.savePaperSpecifications(
          job.id,
          'production_jobs',
          paperType,
          paperWeight
        );

        if (success) {
          console.log(`✅ Successfully backfilled job ${job.wo_no}`);
          results.processed++;
        } else {
          console.log(`⚠️  Could not resolve specs for job ${job.wo_no}`);
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
