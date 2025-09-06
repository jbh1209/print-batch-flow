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

    // 1. Get existing stage data from database
    const { data: stageSlots, error: slotsError } = await supabase
      .from('stage_time_slots')
      .select('stage_instance_id, duration_minutes, production_stage_id, job_id')
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

    // 3. Delete existing time slots and recreate to avoid unique constraint violations
    console.log(`Deleting existing slots for ${cleanStageIds.length} stages`);
    
    const { error: deleteError } = await supabase
      .from('stage_time_slots')
      .delete()
      .in('stage_instance_id', cleanStageIds)
      .eq('date', date);

    if (deleteError) {
      throw new Error(`Failed to delete existing slots: ${deleteError.message}`);
    }

    // 4. Insert new time slots with updated times
    const slotsToInsert = updatedSlots.map(slot => {
      const existingSlot = stageSlots.find(s => s.stage_instance_id === slot.stage_instance_id);
      if (!existingSlot) {
        throw new Error(`Missing slot data for stage ${slot.stage_instance_id}`);
      }
      return {
        production_stage_id: existingSlot.production_stage_id,
        date: date,
        slot_start_time: slot.slot_start_time,
        slot_end_time: slot.slot_end_time,
        duration_minutes: existingSlot.duration_minutes,
        job_id: existingSlot.job_id,
        job_table_name: 'production_jobs',
        stage_instance_id: slot.stage_instance_id,
        is_completed: false
      };
    });

    const { error: insertError } = await supabase
      .from('stage_time_slots')
      .insert(slotsToInsert);

    if (insertError) {
      throw new Error(`Failed to insert new slots: ${insertError.message}`);
    }

    // 5. Update job_stage_instances with new times
    const instanceUpdates = updatedSlots.map(slot => ({
      id: slot.stage_instance_id,
      scheduled_start_at: slot.slot_start_time,
      scheduled_end_at: slot.slot_end_time,
      updated_at: new Date().toISOString()
    }));

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