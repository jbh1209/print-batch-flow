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

    // Get all existing time slots for the stage instances
    const { data: allTimeSlots, error: slotsError } = await supabase
      .from('stage_time_slots')
      .select('id, stage_instance_id, duration_minutes, slot_start_time, slot_end_time')
      .in('stage_instance_id', cleanStageIds)
      .eq('date', date)
      .order('slot_start_time', { ascending: true });

    if (slotsError) {
      throw new Error(`Failed to fetch stage slots: ${slotsError.message}`);
    }

    if (!allTimeSlots || allTimeSlots.length === 0) {
      throw new Error('No time slots found for the specified date');
    }

    // Group slots by stage instance and calculate total duration
    const stageMap = new Map();
    allTimeSlots.forEach(slot => {
      if (!stageMap.has(slot.stage_instance_id)) {
        stageMap.set(slot.stage_instance_id, {
          slots: [],
          totalDuration: 0
        });
      }
      const stageData = stageMap.get(slot.stage_instance_id);
      stageData.slots.push(slot);
      stageData.totalDuration += slot.duration_minutes;
    });

    // Calculate new sequential times based on user's provided order
    const shiftDate = new Date(`${date}T${shiftStartTime}:00Z`);
    let currentTime = new Date(shiftDate);
    const updatedSlots = [];
    const instanceUpdates = [];

    // Process stages in the order provided by user (they've already arranged them)
    for (let i = 0; i < cleanStageIds.length; i++) {
      const stageId = cleanStageIds[i];
      const stageData = stageMap.get(stageId);
      
      if (!stageData) {
        console.warn(`No slots found for stage instance ${stageId}`);
        continue;
      }

      // Add small microsecond offset to avoid any constraint conflicts
      const stageStartTime = new Date(currentTime.getTime() + i);
      const stageEndTime = new Date(stageStartTime.getTime() + stageData.totalDuration * 60 * 1000);
      
      console.log(`Stage ${stageId}: ${stageData.totalDuration} mins from ${stageStartTime.toISOString()}`);
      
      // Update all slots for this stage sequentially
      let slotStartTime = new Date(stageStartTime);
      for (const slot of stageData.slots) {
        const slotEndTime = new Date(slotStartTime.getTime() + slot.duration_minutes * 60 * 1000);
        
        updatedSlots.push({
          id: slot.id,
          slot_start_time: slotStartTime.toISOString(),
          slot_end_time: slotEndTime.toISOString()
        });

        slotStartTime = new Date(slotEndTime);
      }

      // Track instance updates
      instanceUpdates.push({
        id: stageId,
        scheduled_start_at: stageStartTime.toISOString(),
        scheduled_end_at: stageEndTime.toISOString()
      });

      // Next stage starts after this one ends
      currentTime = new Date(stageEndTime);
    }

    // Update existing time slots with new times
    console.log(`Updating ${updatedSlots.length} time slots`);
    
    for (const slot of updatedSlots) {
      const { error: updateError } = await supabase
        .from('stage_time_slots')
        .update({
          slot_start_time: slot.slot_start_time,
          slot_end_time: slot.slot_end_time,
          updated_at: new Date().toISOString()
        })
        .eq('id', slot.id);

      if (updateError) {
        throw new Error(`Failed to update slot ${slot.id}: ${updateError.message}`);
      }
    }

    // Update job_stage_instances with new times
    for (const update of instanceUpdates) {
      const { error: instanceError } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: update.scheduled_start_at,
          scheduled_end_at: update.scheduled_end_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id);

      if (instanceError) {
        throw new Error(`Failed to update instance ${update.id}: ${instanceError.message}`);
      }
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