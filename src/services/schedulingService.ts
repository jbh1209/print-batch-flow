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
    const version = await this.getSchedulerVersion().catch(() => 2 as 1 | 2);

    if (version === 1) {
      // Legacy first, then try v2
      const { data: legacy, error: legacyErr } = await supabase.functions.invoke("schedule-on-approval", {
        body: req,
      });
      if (!legacyErr && (legacy as any)?.ok) return legacy as ScheduleOnApprovalResponse;

      const { data: v2, error: v2Err } = await supabase.functions.invoke("schedule-v2", {
        body: req,
      });
      if (!v2Err && (v2 as any)?.ok) return v2 as ScheduleOnApprovalResponse;

      return { ok: false, error: legacyErr?.message || v2Err?.message || "Scheduling failed" };
    } else {
      // v2 first, then fallback to legacy
      const { data: v2, error: v2Err } = await supabase.functions.invoke("schedule-v2", {
        body: req,
      });
      if (!v2Err && (v2 as any)?.ok) return v2 as ScheduleOnApprovalResponse;

      const { data: legacy, error: legacyErr } = await supabase.functions.invoke("schedule-on-approval", {
        body: req,
      });
      if (!legacyErr && (legacy as any)?.ok) return legacy as ScheduleOnApprovalResponse;

      return { ok: false, error: v2Err?.message || legacyErr?.message || "Scheduling failed" };
    }
  }

  private static async getSchedulerVersion(): Promise<1 | 2> {
    const { data, error } = await supabase.functions.invoke("scheduler-settings", {
      body: { action: "get_version" },
    });
    if (error) return 2;
    const v = (data as any)?.version;
    return v === 1 ? 1 : 2;
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
