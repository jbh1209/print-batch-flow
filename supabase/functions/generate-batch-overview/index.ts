
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
    // Get the batch ID from the request
    const { batchId } = await req.json()
    
    if (!batchId) {
      return new Response(
        JSON.stringify({ error: "Batch ID is required" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400 
        }
      )
    }

    // Create a Supabase client with the Service Role Key
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    )

    console.log(`Generating overview PDF for batch ${batchId}`)
    
    // Fetch batch details
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("*")
      .eq("id", batchId)
      .single()
    
    if (batchError) {
      throw new Error(`Error fetching batch: ${batchError.message}`)
    }
    
    if (!batch) {
      return new Response(
        JSON.stringify({ error: "Batch not found" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404 
        }
      )
    }
    
    // Find which job table contains jobs for this batch
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
    
    let batchJobs = null
    let jobTable = null
    
    for (const table of jobTables) {
      const { data: jobs } = await supabase
        .from(table)
        .select("*")
        .eq("batch_id", batchId)
      
      if (jobs && jobs.length > 0) {
        jobTable = table
        batchJobs = jobs
        break
      }
    }
    
    if (!batchJobs || batchJobs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No jobs found for this batch" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404 
        }
      )
    }
    
    console.log(`Found ${batchJobs.length} jobs in table ${jobTable}`)
    
    // Here we would normally generate the PDF, but since that requires the frontend PDF generation code,
    // we'll just update the batch record to indicate it needs a PDF
    
    await supabase
      .from("batches")
      .update({ 
        needs_overview_pdf: true 
      })
      .eq("id", batchId)
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Batch marked for overview PDF generation",
        batchId,
        jobCount: batchJobs.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
    
  } catch (error) {
    console.error("Error in generate-batch-overview function:", error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    )
  }
})
