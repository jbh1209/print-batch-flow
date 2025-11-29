import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { corsHeaders } from '../_shared/cors.ts'

const PROOF_STAGE_ID = 'ea194968-3604-44a3-9314-d190bb5691c7'
const LARGE_PAPER_SIZE_ID = 'ba0589b6-6708-491a-9b18-e90dcaf62f23'

interface ApprovalResult {
  woNo: string
  success: boolean
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { startOrderNum, endOrderNum } = await req.json()
    
    console.log(`🚀 Starting bulk approval for orders ${startOrderNum} to ${endOrderNum}`)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all jobs in the range
    const { data: jobs, error: jobsError } = await supabase
      .from('production_jobs')
      .select('id, wo_no, status')
      .gte('wo_no', `D${startOrderNum}`)
      .lte('wo_no', `D${endOrderNum}`)
      .order('wo_no')

    if (jobsError) {
      console.error('❌ Error fetching jobs:', jobsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch jobs', details: jobsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ 
          processed: 0, 
          failed: 0, 
          message: `No jobs found in range D${startOrderNum} to D${endOrderNum}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📦 Found ${jobs.length} jobs to process`)

    const results: ApprovalResult[] = []
    let processed = 0
    let failed = 0

    // Process each job sequentially with delay
    for (const job of jobs) {
      try {
        console.log(`\n🔄 Processing ${job.wo_no} (${job.id})...`)

        // Step 1: Get the PROOF stage instance
        const { data: proofStage, error: proofError } = await supabase
          .from('job_stage_instances')
          .select('id, status, stage_order')
          .eq('job_id', job.id)
          .eq('production_stage_id', PROOF_STAGE_ID)
          .single()

        if (proofError || !proofStage) {
          console.error(`❌ ${job.wo_no}: No PROOF stage found`)
          results.push({ woNo: job.wo_no, success: false, error: 'No PROOF stage found' })
          failed++
          continue
        }

        if (proofStage.status === 'completed') {
          console.log(`⚠️ ${job.wo_no}: Already completed, skipping`)
          results.push({ woNo: job.wo_no, success: true, error: 'Already completed' })
          processed++
          continue
        }

        const currentTime = new Date().toISOString()

        // Step 2: Mark proof as emailed and approved
        const { error: emailError } = await supabase
          .from('job_stage_instances')
          .update({
            proof_emailed_at: currentTime,
            proof_approved_manually_at: currentTime,
            updated_at: currentTime
          })
          .eq('id', proofStage.id)

        if (emailError) {
          console.error(`❌ ${job.wo_no}: Failed to mark proof emailed:`, emailError)
          results.push({ woNo: job.wo_no, success: false, error: 'Failed to mark proof emailed' })
          failed++
          continue
        }

        console.log(`✅ ${job.wo_no}: Marked proof as emailed and approved`)

        // Step 3: Set HP12000 paper sizes to Large
        const { error: paperSizeError } = await supabase
          .from('job_stage_instances')
          .update({
            hp12000_paper_size_id: LARGE_PAPER_SIZE_ID,
            updated_at: currentTime
          })
          .eq('job_id', job.id)
          .not('hp12000_paper_size_id', 'is', null)

        if (paperSizeError) {
          console.warn(`⚠️ ${job.wo_no}: Failed to set paper sizes:`, paperSizeError)
          // Continue anyway - not all jobs have HP12000 stages
        } else {
          console.log(`✅ ${job.wo_no}: Set HP12000 paper sizes to Large`)
        }

        // Step 4: Complete the PROOF stage
        const { error: completeError } = await supabase
          .from('job_stage_instances')
          .update({
            status: 'completed',
            completed_at: currentTime,
            updated_at: currentTime
          })
          .eq('id', proofStage.id)

        if (completeError) {
          console.error(`❌ ${job.wo_no}: Failed to complete PROOF stage:`, completeError)
          results.push({ woNo: job.wo_no, success: false, error: 'Failed to complete PROOF stage' })
          failed++
          continue
        }

        console.log(`✅ ${job.wo_no}: Completed PROOF stage`)

        // Step 5: Advance to next stage using the RPC function
        const { error: advanceError } = await supabase.rpc('advance_job_stage', {
          p_job_id: job.id,
          p_job_table_name: 'production_jobs',
          p_current_stage_id: proofStage.id
        })

        if (advanceError) {
          console.error(`❌ ${job.wo_no}: Failed to advance stage:`, advanceError)
          results.push({ woNo: job.wo_no, success: false, error: 'Failed to advance stage' })
          failed++
          continue
        }

        console.log(`✅ ${job.wo_no}: Advanced to next stage`)

        // Step 6: Update production job to set proof_approved_at
        const { error: jobUpdateError } = await supabase
          .from('production_jobs')
          .update({
            proof_approved_at: currentTime,
            updated_at: currentTime
          })
          .eq('id', job.id)

        if (jobUpdateError) {
          console.warn(`⚠️ ${job.wo_no}: Failed to update production job:`, jobUpdateError)
          // Continue anyway - stage is already advanced
        }

        console.log(`✅ ${job.wo_no}: Updated production job`)

        // Step 7: Call scheduler to add to schedule
        const { error: scheduleError } = await supabase.rpc('scheduler_append_jobs', {
          p_job_ids: [job.id]
        })

        if (scheduleError) {
          console.warn(`⚠️ ${job.wo_no}: Failed to add to schedule:`, scheduleError)
          // Continue anyway - job is approved
        } else {
          console.log(`✅ ${job.wo_no}: Added to schedule`)
        }

        results.push({ woNo: job.wo_no, success: true })
        processed++
        console.log(`✅ ${job.wo_no}: Successfully processed`)

        // Delay 3 seconds before next job
        await new Promise(resolve => setTimeout(resolve, 3000))

      } catch (error) {
        console.error(`❌ ${job.wo_no}: Unexpected error:`, error)
        results.push({ 
          woNo: job.wo_no, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
        failed++
      }
    }

    console.log(`\n🏁 Bulk approval complete: ${processed} processed, ${failed} failed`)

    return new Response(
      JSON.stringify({
        processed,
        failed,
        total: jobs.length,
        results,
        message: `Processed ${processed} of ${jobs.length} jobs. ${failed} failed.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Bulk approval error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
