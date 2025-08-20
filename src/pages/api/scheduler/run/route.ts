// app/api/scheduler/run/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { planSchedule, SchedulerInput } from '../../../../tracker/schedule-board/scheduler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Missing SUPABASE env vars' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
  const { data: snap, error: exportErr } = await supabase.rpc('export_scheduler_input');
  if (exportErr) return NextResponse.json({ error: 'export_scheduler_input failed', detail: exportErr }, { status: 500 });

  const input = snap as SchedulerInput;
  const { updates } = planSchedule(input);

  const url = new URL(req.url);
  const commit = (url.searchParams.get('commit') ?? 'true') === 'true';
  const proposed = (url.searchParams.get('proposed') ?? 'true') === 'true';
  const onlyIfUnset = (url.searchParams.get('onlyIfUnset') ?? 'true') === 'true';

  let applied: unknown = { updated: 0 };
  if (commit && updates.length) {
    const { data, error } = await supabase.rpc('apply_stage_updates_safe', {
      updates,
      commit: true,
      only_if_unset: onlyIfUnset,
      as_proposed: proposed,
    });
    if (error) return NextResponse.json({ error: 'apply_stage_updates_safe failed', detail: error }, { status: 500 });
    applied = data;
  }

  return NextResponse.json({ ok: true, scheduled: updates.length, applied, updates }, { status: 200 });
}
