import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { corsHeaders } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Service Role Key for admin access
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    )

    console.log("Started batch cleanup process")

    // Find batches marked as "sent" that are older than 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: oldBatches, error: fetchError } = await supabase
      .from("batches")
      .select("id, name, status, created_at")
      .eq("status", "sent")
      .lt("created_at", sevenDaysAgo.toISOString())
    
    if (fetchError) {
      throw new Error(`Error fetching old batches: ${fetchError.message}`)
    }
    
    console.log(`Found ${oldBatches?.length || 0} old batches to process`)
    
    // Keep track of batches we've processed
    const processedBatches = []
    const errors = []
    
    // Process each batch
    for (const batch of oldBatches || []) {
      let jobTableName: string | null = null; // Declare at function scope
      try {
        console.log(`Processing batch ${batch.id} (${batch.name})`)
        
        // 1. Check if this batch already has a stored overview PDF
        const { data: batchData } = await supabase
          .from("batches")
          .select("overview_pdf_url")
          .eq("id", batch.id)
          .single()
          
        if (!batchData?.overview_pdf_url) {
          // If no overview PDF exists yet, we need to find all jobs in this batch and generate one
          console.log(`Batch ${batch.id} has no overview PDF, generating one`)
          
          // Collect all job tables we need to check
          const jobTables = [
            "business_card_jobs", 
            "flyer_jobs", 
            "sleeve_jobs", 
            "postcard_jobs", 
            "poster_jobs", 
            "box_jobs", 
            "sticker_jobs", 
            "cover_jobs"
          ]
          
          // Find which table contains jobs for this batch
          let batchJobs = null
          
          for (const table of jobTables) {
            const { data: jobs } = await supabase
              .from(table)
              .select("*")
              .eq("batch_id", batch.id)
              .limit(1)
            
            if (jobs && jobs.length > 0) {
              jobTableName = table
              // Now fetch all jobs for this batch from the identified table
              const { data: allJobs } = await supabase
                .from(table)
                .select("*")
                .eq("batch_id", batch.id)
              
              batchJobs = allJobs
              break
            }
          }
          
          if (!batchJobs || batchJobs.length === 0) {
            console.log(`No jobs found for batch ${batch.id}`)
            continue
          }
          
          console.log(`Found ${batchJobs.length} jobs in table ${jobTableName} for batch ${batch.id}`)
          
          // 2. Generate overview PDF (fetch batch data from frontend via POST to endpoint)
          // This is a placeholder for the overview PDF generation
          // We would normally call the PDF generation function here
          console.log(`Batch ${batch.id} would have overview PDF generated and stored`)
          
          // For now, we'll just set a flag indicating this batch needs attention
          await supabase
            .from("batches")
            .update({ 
              needs_overview_pdf: true 
            })
            .eq("id", batch.id)
          
          processedBatches.push(batch.id)
        } else {
          console.log(`Batch ${batch.id} already has an overview PDF: ${batchData.overview_pdf_url}`)
        }
        
        // 3. Delete individual job PDFs from storage (if they exist)
        // This would require identifying which storage bucket contains the PDFs
        // and then removing them
        console.log(`Would delete job PDFs for batch ${batch.id}`)
        
        // 4. Delete job records but keep batch record
        if (jobTableName) {
          await supabase
            .from(jobTableName)
            .update({ pdf_url: null, status: "archived" })
            .eq("batch_id", batch.id)
          
          console.log(`Marked jobs as archived for batch ${batch.id}`)
        }
        
      } catch (err) {
        console.error(`Error processing batch ${batch.id}:`, err)
        errors.push({ batchId: batch.id, error: err instanceof Error ? err.message : String(err) })
      }
    }
    
    // Return the results
    return new Response(
      JSON.stringify({
        processedBatches,
        errors,
        message: `Processed ${processedBatches.length} old batches with ${errors.length} errors`
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
    
  } catch (error) {
    console.error("Error in cleanup-batch-jobs function:", error)
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})
