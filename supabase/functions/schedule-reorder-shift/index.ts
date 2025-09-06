import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReorderRequest {
  date: string;
  timeSlot: string;
  stageIds: string[];
  shiftStartTime: string;
  shiftEndTime: string;
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

    const { date, timeSlot, stageIds, shiftStartTime, shiftEndTime }: ReorderRequest = await req.json();

    console.log(`Reordering shift for ${date} ${timeSlot} with ${stageIds.length} stages`);

    // 1. Fetch stage time slots separately
    const { data: stageSlots, error: slotsError } = await supabase
      .from('stage_time_slots')
      .select(`
        id,
        stage_instance_id,
        slot_start_time,
        slot_end_time,
        duration_minutes,
        job_id,
        production_stage_id
      `)
      .in('stage_instance_id', stageIds)
      .eq('date', date);

    if (slotsError) {
      throw new Error(`Failed to fetch stage slots: ${slotsError.message}`);
    }

    if (!stageSlots || stageSlots.length !== stageIds.length) {
      throw new Error('Some stages not found or do not belong to the specified date');
    }

    // 2. Fetch job stage instances separately
    const { data: stageInstances, error: instancesError } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        stage_order,
        is_split_job
      `)
      .in('id', stageIds);

    if (instancesError) {
      throw new Error(`Failed to fetch stage instances: ${instancesError.message}`);
    }

    if (!stageInstances || stageInstances.length !== stageIds.length) {
      throw new Error('Some stage instances not found');
    }

    // 3. Merge the data for processing
    const existingStages = stageSlots.map(slot => {
      const instance = stageInstances.find(inst => inst.id === slot.stage_instance_id);
      return {
        ...slot,
        job_stage_instances: instance
      };
    });

    // 2. Preserve split jobs at the end of reordered list
    const splitStages = existingStages.filter(stage => 
      stage.job_stage_instances.is_split_job
    );
    const nonSplitStageIds = stageIds.filter(id => 
      !splitStages.some(split => split.stage_instance_id === id)
    );
    const splitStageIds = splitStages.map(stage => stage.stage_instance_id);
    const finalStageOrder = [...nonSplitStageIds, ...splitStageIds];

    console.log(`Reordered: ${nonSplitStageIds.length} regular + ${splitStageIds.length} split stages`);

    // 3. Calculate new start times for the reordered stages
    // We use a simple sequential approach within the shift
    const shiftDate = new Date(`${date}T${shiftStartTime}:00Z`);
    let currentTime = new Date(shiftDate);

    const updatedSlots = [];
    
    for (let i = 0; i < finalStageOrder.length; i++) {
      const stageId = finalStageOrder[i];
      const stage = existingStages.find(s => s.stage_instance_id === stageId);
      
      if (!stage) continue;

      const newStartTime = new Date(currentTime);
      const newEndTime = new Date(currentTime.getTime() + stage.duration_minutes * 60 * 1000);
      
      updatedSlots.push({
        stage_instance_id: stageId,
        slot_start_time: newStartTime.toISOString(),
        slot_end_time: newEndTime.toISOString()
      });

      // Move current time forward for next stage
      currentTime = new Date(newEndTime);
    }

    // 4. Update the database with new times
    const updatePromises = updatedSlots.map(async (slot) => {
      // Update stage_time_slots
      const { error: slotError } = await supabase
        .from('stage_time_slots')
        .update({
          slot_start_time: slot.slot_start_time,
          slot_end_time: slot.slot_end_time,
          updated_at: new Date().toISOString()
        })
        .eq('stage_instance_id', slot.stage_instance_id);

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

    console.log(`Successfully reordered ${updatedSlots.length} stages in shift ${timeSlot}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reordered ${updatedSlots.length} stages in shift`,
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