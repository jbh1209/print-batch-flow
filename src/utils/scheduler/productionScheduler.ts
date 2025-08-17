/**
 * Main production scheduler - Simple FIFO implementation
 */

import { supabase } from "@/integrations/supabase/client";
import { ScheduledStage, WorkingDayContainer } from './types';
import { generateWorkingDays } from './workingDayManager';
import { processStagesSequentially } from './stageProcessor';

/**
 * Fetch all pending job stage instances in FIFO order by proof approval
 */
async function getPendingStages(): Promise<Omit<ScheduledStage, 'scheduled_start_at' | 'scheduled_end_at'>[]> {
  const { data: stages, error } = await supabase
    .from('job_stage_instances')
    .select(`
      id,
      job_id,
      job_table_name,
      production_stage_id,
      stage_order,
      estimated_duration_minutes,
      category_id,
      production_stages!inner(name),
      production_jobs!inner(wo_no, proof_approved_at)
    `)
    .eq('status', 'pending')
    .not('production_stages.name', 'ilike', '%dtp%')
    .not('production_stages.name', 'ilike', '%proof%')
    .not('production_stages.name', 'ilike', '%batch%allocation%')
    .order('production_jobs.proof_approved_at', { ascending: true });

  if (error) {
    console.error('Error fetching pending stages:', error);
    throw error;
  }

  return (stages || []).map(stage => ({
    id: stage.id,
    job_id: stage.job_id,
    job_table_name: stage.job_table_name,
    production_stage_id: stage.production_stage_id,
    stage_name: (stage.production_stages as any)?.name || 'Unknown Stage',
    job_wo_no: (stage.production_jobs as any)?.wo_no || 'Unknown',
    stage_order: stage.stage_order,
    estimated_duration_minutes: stage.estimated_duration_minutes || 60,
    proof_approved_at: new Date((stage.production_jobs as any)?.proof_approved_at || new Date()),
    category_id: stage.category_id
  }));
}

/**
 * Main scheduler function - Simple FIFO processing
 */
export async function calculateSequentialSchedule(): Promise<WorkingDayContainer[]> {
  try {
    console.log('Starting sequential scheduler...');
    
    // Get all pending stages
    const pendingStages = await getPendingStages();
    console.log(`Found ${pendingStages.length} pending stages`);
    
    if (pendingStages.length === 0) {
      return [];
    }
    
    // Generate working days starting from tomorrow
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);
    
    const workingDays = await generateWorkingDays(startDate, 30);
    console.log(`Generated ${workingDays.length} working days`);
    
    // Process all stages in strict FIFO order
    const scheduledStages = processStagesSequentially(pendingStages, workingDays);
    console.log(`Scheduled ${scheduledStages.length} stages`);
    
    // Return only working days that have scheduled stages
    return workingDays.filter(day => day.scheduled_stages.length > 0);
    
  } catch (error) {
    console.error('Error in calculateSequentialSchedule:', error);
    throw error;
  }
}

/**
 * Update scheduled times in the database
 */
export async function updateScheduledTimes(scheduledStages: ScheduledStage[]): Promise<boolean> {
  try {
    // Use individual updates instead of upsert to avoid type issues
    for (const stage of scheduledStages) {
      const { error } = await supabase
        .from('job_stage_instances')
        .update({
          scheduled_start_at: stage.scheduled_start_at.toISOString(),
          scheduled_end_at: stage.scheduled_end_at.toISOString(),
          scheduled_minutes: stage.estimated_duration_minutes,
          schedule_status: 'scheduled'
        })
        .eq('id', stage.id);
      
      if (error) {
        console.error(`Error updating stage ${stage.id}:`, error);
        return false;
      }
    }
    
    console.log(`Updated ${scheduledStages.length} stage instances with scheduled times`);
    return true;
    
  } catch (error) {
    console.error('Error in updateScheduledTimes:', error);
    return false;
  }
}