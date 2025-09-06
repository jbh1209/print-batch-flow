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

    // 1. Get existing stage durations from database
    const { data: stageSlots, error: slotsError } = await supabase
      .from('stage_time_slots')
      .select('stage_instance_id, duration_minutes')
      .in('stage_instance_id', cleanStageIds)
      .eq('date', date);

    if (slotsError) {
      throw new Error(`Failed to fetch stage slots: ${slotsError.message}`);
    }

    if (!stageSlots || stageSlots.length === 0) {
      throw new Error('No stages found for the specified date');
    }

    // 2. Calculate new sequential times in the exact order provided
    const shiftDate = new Date(`${date}T${shiftStartTime}:00Z`);
    let currentTime = new Date(shiftDate);
    const updatedSlots = [];

    for (const stageId of cleanStageIds) {
      const stageSlot = stageSlots.find(s => s.stage_instance_id === stageId);
      if (!stageSlot) continue;

      const newStartTime = new Date(currentTime);
      const newEndTime = new Date(currentTime.getTime() + stageSlot.duration_minutes * 60 * 1000);
      
      updatedSlots.push({
        stage_instance_id: stageId,
        slot_start_time: newStartTime.toISOString(),
        slot_end_time: newEndTime.toISOString()
      });

      // Move to next stage start time
      currentTime = new Date(newEndTime);
    }

    // 3. Update database with new times
    const updatePromises = updatedSlots.map(async (slot) => {
      // Update stage_time_slots
      const { error: slotError } = await supabase
        .from('stage_time_slots')
        .update({
          slot_start_time: slot.slot_start_time,
          slot_end_time: slot.slot_end_time,
          updated_at: new Date().toISOString()
        })
        .eq('stage_instance_id', slot.stage_instance_id)
        .eq('date', date);

      if (slotError) {
        console.error(`Failed to update slot for ${slot.stage_instance_id}:`, slotError);
        return { success: false, error: slotError };
      }

      // Update job_stage_instances
      const { error: instanceError } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: slot.slot_start_time,
          scheduled_end_at: slot.slot_end_time,
          updated_at: new Date().toISOString()
        })
        .eq('id', slot.stage_instance_id);

      if (instanceError) {
        console.error(`Failed to update instance for ${slot.stage_instance_id}:`, instanceError);
        return { success: false, error: instanceError };
      }

      return { success: true };
    });

    const results = await Promise.all(updatePromises);
    const failures = results.filter(r => !r.success);

    if (failures.length > 0) {
      throw new Error(`Failed to update ${failures.length} stages`);
    }

    console.log(`Successfully reordered ${updatedSlots.length} stages`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reordered ${updatedSlots.length} stages`,
        updatedStages: updatedSlots.length
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