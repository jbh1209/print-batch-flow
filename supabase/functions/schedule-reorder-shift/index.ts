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

    const { date, timeSlot, stageIds, shiftStartTime, shiftEndTime, dayWideReorder, groupingType }: ReorderRequest = await req.json();

    // Validate stage IDs and log warnings for carry suffixes
    const cleanStageIds = stageIds.map(id => {
      if (id.includes('-carry')) {
        console.warn(`Stage ID contains -carry suffix: ${id}, this should be stripped on frontend`);
        return id.replace('-carry', '');
      }
      return id;
    });

    const logContext = dayWideReorder ? '(day-wide)' : ` at ${timeSlot}`;
    const groupingContext = groupingType ? ` with ${groupingType} grouping` : '';
    console.log(`Reordering ${cleanStageIds.length} stages for ${date}${logContext}${groupingContext}`);

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
      .in('stage_instance_id', cleanStageIds)
      .eq('date', date);

    if (slotsError) {
      throw new Error(`Failed to fetch stage slots: ${slotsError.message}`);
    }

    // Validate based on unique stage instance IDs, not slot count (stages can have multiple slots)
    const foundStageInstanceIds = [...new Set(stageSlots?.map(s => s.stage_instance_id) || [])];
    
    if (!stageSlots || foundStageInstanceIds.length !== cleanStageIds.length) {
      const missingIds = cleanStageIds.filter(id => !foundStageInstanceIds.includes(id));
      console.error(`Missing stage slots for IDs: ${missingIds.join(', ')}`);
      console.error(`Found ${foundStageInstanceIds.length} unique stage instances, expected ${cleanStageIds.length}`);
      throw new Error(`Some stages not found or do not belong to the specified date: ${missingIds.join(', ')}`);
    }

    // 2. Fetch job stage instances separately
    const { data: stageInstances, error: instancesError } = await supabase
      .from('job_stage_instances')
      .select(`
        id,
        stage_order,
        is_split_job
      `)
      .in('id', cleanStageIds);

    if (instancesError) {
      throw new Error(`Failed to fetch stage instances: ${instancesError.message}`);
    }

    if (!stageInstances || stageInstances.length !== cleanStageIds.length) {
      const foundInstanceIds = stageInstances?.map(s => s.id) || [];
      const missingInstanceIds = cleanStageIds.filter(id => !foundInstanceIds.includes(id));
      console.error(`Missing stage instances for IDs: ${missingInstanceIds.join(', ')}`);
      console.error(`Found ${foundInstanceIds.length} instances, expected ${cleanStageIds.length}`);
      throw new Error(`Some stage instances not found: ${missingInstanceIds.join(', ')}`);
    }

    // 3. Merge the data for processing
    const existingStages = stageSlots.map(slot => {
      const instance = stageInstances.find(inst => inst.id === slot.stage_instance_id);
      return {
        ...slot,
        job_stage_instances: instance
      };
    });

    // 4. Handle cover/text job relationships and maintain proper ordering
    const jobStagesMap = new Map<string, typeof existingStages>();
    existingStages.forEach(stage => {
      const jobId = stage.job_id;
      if (!jobStagesMap.has(jobId)) {
        jobStagesMap.set(jobId, []);
      }
      jobStagesMap.get(jobId)!.push(stage);
    });

    // Sort stages within each job by stage_order to maintain cover/text relationships
    jobStagesMap.forEach((stages, jobId) => {
      stages.sort((a, b) => {
        const orderA = a.job_stage_instances?.stage_order || 0;
        const orderB = b.job_stage_instances?.stage_order || 0;
        return orderA - orderB;
      });
    });

    // Rebuild final stage order respecting the provided order and cover/text relationships
    const finalStageOrder: string[] = [];
    const processedStages = new Set<string>();
    
    cleanStageIds.forEach(stageId => {
      if (processedStages.has(stageId)) return;
      
      const stage = existingStages.find(s => s.stage_instance_id === stageId);
      if (!stage) return;
      
      const jobStages = jobStagesMap.get(stage.job_id) || [];
      
      // Add all stages from this job that are in our list, in proper order
      jobStages.forEach(jobStage => {
        if (cleanStageIds.includes(jobStage.stage_instance_id) && !processedStages.has(jobStage.stage_instance_id)) {
          finalStageOrder.push(jobStage.stage_instance_id);
          processedStages.add(jobStage.stage_instance_id);
        }
      });
    });

    // Preserve split jobs at the end of reordered list
    const splitStages = existingStages.filter(stage => 
      stage.job_stage_instances?.is_split_job
    );
    const splitStageIds = splitStages.map(stage => stage.stage_instance_id);
    const nonSplitStageIds = finalStageOrder.filter(id => 
      !splitStageIds.includes(id)
    );
    const finalOrderWithSplits = [...nonSplitStageIds, ...splitStageIds];

    console.log(`Reordered: ${nonSplitStageIds.length} regular + ${splitStageIds.length} split stages for ${jobStagesMap.size} jobs`);

    // 5. Calculate new start times for the reordered stages
    // We use a simple sequential approach within the shift
    const shiftDate = new Date(`${date}T${shiftStartTime}:00Z`);
    let currentTime = new Date(shiftDate);

    const updatedSlots = [];
    
    for (let i = 0; i < finalOrderWithSplits.length; i++) {
      const stageId = finalOrderWithSplits[i];
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

    console.log(`Successfully reordered ${updatedSlots.length} stages${dayWideReorder ? ' day-wide' : ` in shift ${timeSlot}`}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Reordered ${updatedSlots.length} stages${dayWideReorder ? ' day-wide' : ' in shift'}`,
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