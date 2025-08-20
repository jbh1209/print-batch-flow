// pages/api/scheduler/run.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { planSchedule, SchedulerInput } from '../../../tracker/schedule-board/scheduler';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Missing SUPABASE env vars' });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    const { data: snap, error: exportErr } = await supabase.rpc('export_scheduler_input');
    if (exportErr) return res.status(500).json({ error: 'export_scheduler_input failed', detail: exportErr });
    const input = snap as SchedulerInput;

    const { updates } = planSchedule(input);

    const commit = (req.query.commit ?? 'true') === 'true';
    const proposed = (req.query.proposed ?? 'true') === 'true';
    const onlyIfUnset = (req.query.onlyIfUnset ?? 'true') === 'true';

    let applied: any = { updated: 0 };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc('apply_stage_updates_safe', { updates, commit: true, only_if_unset: onlyIfUnset, as_proposed: proposed });
      if (error) return res.status(500).json({ error: 'apply_stage_updates_safe failed', detail: error });
      applied = data;
    }

    return res.status(200).json({ ok: true, scheduled: updates.length, applied, updates });
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
