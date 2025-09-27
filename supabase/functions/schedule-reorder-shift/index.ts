import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReorderRequest {
  date: string;
  timeSlot?: string;  // Optional for backward compatibility
  stageIds: string[];
  shiftStartTime: string;
  shiftEndTime: string;
  dayWideReorder?: boolean; // New flag for day-wide reordering
  groupingType?: 'paper' | 'lamination' | null; // New parameter for auto-grouping
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    const { date, stageIds, shiftStartTime }: ReorderRequest = await req.json();

    // Clean stage IDs (remove any carry suffixes)
    const cleanStageIds = stageIds.map(id => id.replace('-carry', ''));

    console.log(`Reordering ${cleanStageIds.length} stages for ${date} starting at ${shiftStartTime}`);

    // Get durations for each stage from existing slots
    const stageDurations = new Map();
    
    for (const stageId of cleanStageIds) {
      const { data: slots } = await supabase
        .from('stage_time_slots')
        .select('duration_minutes')
        .eq('stage_instance_id', stageId)
        .eq('date', date);
      
      if (slots && slots.length > 0) {
        const totalDuration = slots.reduce((sum, slot) => sum + slot.duration_minutes, 0);
        stageDurations.set(stageId, totalDuration);
      }
    }

    // Calculate new sequential times
    const shiftStart = new Date(`${date}T${shiftStartTime}:00Z`);
    let currentTime = new Date(shiftStart);

    // Update each stage sequentially
    for (const stageId of cleanStageIds) {
      const duration = stageDurations.get(stageId) || 0;
      if (duration === 0) continue;

      const stageEndTime = new Date(currentTime.getTime() + duration * 60 * 1000);

      // Update all slots for this stage
      await supabase
        .from('stage_time_slots')
        .update({
          slot_start_time: currentTime.toISOString(),
          slot_end_time: stageEndTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('stage_instance_id', stageId)
        .eq('date', date);

      // Update stage instance
      await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: currentTime.toISOString(),
          scheduled_end_at: stageEndTime.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', stageId);

      // Move to next stage start time
      currentTime = new Date(stageEndTime);
    }

    console.log(`Successfully reordered ${cleanStageIds.length} stages`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reordered ${cleanStageIds.length} stages`,
        updatedStages: cleanStageIds.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Reorder shift error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});