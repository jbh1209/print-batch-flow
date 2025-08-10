import { supabase } from "@/integrations/supabase/client";

export interface ScheduleOnApprovalRequest {
  job_id: string;
  job_table_name?: string;
}

export interface ScheduleOnApprovalResponse {
  ok: boolean;
  scheduled?: Array<{ stage_instance_id: string; start: string; end: string; minutes: number }>;
  error?: string;
}

export class SchedulingService {
  static async scheduleOnApproval(req: ScheduleOnApprovalRequest): Promise<ScheduleOnApprovalResponse> {
    const { data, error } = await supabase.functions.invoke("schedule-on-approval", {
      body: req,
    });
    if (error) return { ok: false, error: error.message };
    return data as ScheduleOnApprovalResponse;
  }

  static async recalcTentativeDueDates(): Promise<{ ok: boolean; count?: number; results?: any; error?: string }> {
    const { data, error } = await supabase.functions.invoke("recalc-tentative-due-dates", {
      body: {},
    });
    if (error) return { ok: false, error: error.message };
    return data as any;
  }

  static async manualRescheduleStage(req: { stage_instance_id: string; target_date: string; production_stage_id?: string; job_table_name?: string }): Promise<{ ok: boolean; scheduled_start_at?: string; scheduled_end_at?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke("manual-reschedule-stage", {
      body: req,
    });
    if (error) return { ok: false, error: error.message };
    return data as any;
  }
}

export const schedulingService = SchedulingService;
