// pages/api/scheduler/run.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { planSchedule, SchedulerInput } from '../../../tracker/schedule-board/scheduler';

export const config = {
  api: { bodyParser: true },
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Missing SUPABASE env vars' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // 1) Export snapshot from DB
    const { data: snap, error: exportErr } = await supabase.rpc('export_scheduler_input');
    if (exportErr) {
      return res.status(500).json({ error: 'export_scheduler_input failed', detail: exportErr });
    }
    const input = snap as SchedulerInput;

    // 2) Plan schedule
    const { updates } = planSchedule(input);

    // 3) Parse flags (query or body)
    const q = (k: string, def = 'true') => {
      const v = (req.query as any)[k] ?? (req.body as any)?.[k];
      return (Array.isArray(v) ? v[0] : v) ?? def;
    };
    const commit = String(q('commit')).toLowerCase() === 'true';
    const proposed = String(q('proposed')).toLowerCase() === 'true';
    const onlyIfUnset = String(q('onlyIfUnset')).toLowerCase() === 'true';

    // 4) Optionally persist via safe RPC
    let applied: unknown = { updated: 0 };
    if (commit && updates.length) {
      const { data, error } = await supabase.rpc('apply_stage_updates_safe', {
        updates,
        commit: true,
        only_if_unset: onlyIfUnset,
        as_proposed: proposed,
      });
      if (error) {
        return res.status(500).json({ error: 'apply_stage_updates_safe failed', detail: error });
      }
      applied = data;
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, scheduled: updates.length, applied, updates });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
