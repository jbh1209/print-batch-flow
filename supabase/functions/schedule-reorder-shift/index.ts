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

    // 1. Get ALL existing time slots for the stage instances (there can be multiple per stage)
    const { data: allTimeSlots, error: slotsError } = await supabase
      .from('stage_time_slots')
      .select('id, stage_instance_id, duration_minutes, production_stage_id, job_id, slot_start_time, slot_end_time')
      .in('stage_instance_id', cleanStageIds)
      .eq('date', date)
      .order('slot_start_time', { ascending: true });

    if (slotsError) {
      throw new Error(`Failed to fetch stage slots: ${slotsError.message}`);
    }

    if (!allTimeSlots || allTimeSlots.length === 0) {
      throw new Error('No time slots found for the specified date');
    }

    // 2. Group slots by stage instance and calculate total duration for each stage
    const stageInstanceMap = new Map();
    allTimeSlots.forEach(slot => {
      if (!stageInstanceMap.has(slot.stage_instance_id)) {
        stageInstanceMap.set(slot.stage_instance_id, {
          slots: [],
          totalDuration: 0
        });
      }
      const stageData = stageInstanceMap.get(slot.stage_instance_id);
      stageData.slots.push(slot);
      stageData.totalDuration += slot.duration_minutes;
    });

    // 3. Group stages by their stage_order to detect parallel stages
    const stageOrderGroups = new Map();
    
    // First, get stage order information for grouping
    const { data: stageInstancesInfo, error: instancesError } = await supabase
      .from('job_stage_instances')
      .select('id, stage_order, part_assignment')
      .in('id', cleanStageIds);

    if (instancesError) {
      throw new Error(`Failed to fetch stage instance info: ${instancesError.message}`);
    }

    // Group stage IDs by their order for parallel processing
    cleanStageIds.forEach(stageId => {
      const stageInfo = stageInstancesInfo.find(si => si.id === stageId);
      if (stageInfo) {
        const order = stageInfo.stage_order || 999;
        if (!stageOrderGroups.has(order)) {
          stageOrderGroups.set(order, []);
        }
        stageOrderGroups.get(order).push({
          stageId,
          partAssignment: stageInfo.part_assignment
        });
      }
    });

    // 4. Calculate new times handling parallel stages properly
    const shiftDate = new Date(`${date}T${shiftStartTime}:00Z`);
    let currentTime = new Date(shiftDate);
    const updatedSlots = [];
    const instanceUpdates = [];

    // Process stages in order groups
    const sortedOrders = Array.from(stageOrderGroups.keys()).sort((a, b) => a - b);
    
    for (const stageOrder of sortedOrders) {
      const stageGroup = stageOrderGroups.get(stageOrder);
      console.log(`Processing stage order ${stageOrder} with ${stageGroup.length} parallel stages`);
      
      const groupStartTime = new Date(currentTime);
      let maxGroupEndTime = new Date(currentTime);
      
      // Process all parallel stages in this group
      stageGroup.forEach((stageInfo, index) => {
        const { stageId } = stageInfo;
        const stageData = stageInstanceMap.get(stageId);
        
        if (!stageData) {
          console.warn(`No slots found for stage instance ${stageId}`);
          return;
        }

        // Parallel stages start at the same time with microsecond offsets to avoid conflicts
        const stageStartTime = new Date(groupStartTime.getTime() + index);
        const stageEndTime = new Date(stageStartTime.getTime() + stageData.totalDuration * 60 * 1000);
        
        console.log(`Stage ${stageId} (${stageInfo.partAssignment || 'main'}): ${stageData.totalDuration} mins from ${stageStartTime.toISOString()}`);
        
        // Validate and fix slot data inconsistencies
        let slotStartTime = new Date(stageStartTime);
        for (const slot of stageData.slots) {
          // Calculate what the duration should be vs actual span
          const originalStartTime = new Date(slot.slot_start_time);
          const originalEndTime = new Date(slot.slot_end_time);
          const actualSpanMinutes = Math.round((originalEndTime.getTime() - originalStartTime.getTime()) / (60 * 1000));
          
          if (Math.abs(actualSpanMinutes - slot.duration_minutes) > 1) {
            console.warn(`Data inconsistency detected in slot ${slot.id}: duration_minutes=${slot.duration_minutes} but actual span=${actualSpanMinutes} minutes`);
            // Use the duration_minutes field as authoritative for reordering
          }
          
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
          scheduled_end_at: stageEndTime.toISOString(),
          updated_at: new Date().toISOString()
        });

        // Track the maximum end time for this parallel group
        if (stageEndTime > maxGroupEndTime) {
          maxGroupEndTime = new Date(stageEndTime);
        }
      });
      
      // Next group starts after all parallel stages in this group complete
      currentTime = new Date(maxGroupEndTime);
      console.log(`Stage order ${stageOrder} group completed at ${currentTime.toISOString()}`);
    }

    // 4. Update existing time slots with new times (in-place updates to avoid unique constraint violations)
    console.log(`Updating ${updatedSlots.length} time slots with new times`);
    
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

    // 5. Update job_stage_instances with new times
    for (const update of instanceUpdates) {
      const { error: instanceError } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: update.scheduled_start_at,
          scheduled_end_at: update.scheduled_end_at,
          updated_at: update.updated_at
        })
        .eq('id', update.id);

      if (instanceError) {
        throw new Error(`Failed to update instance ${update.id}: ${instanceError.message}`);
      }
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