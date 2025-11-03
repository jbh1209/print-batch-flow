// tracker/schedule-board/apiHandler.ts
import { createClient } from '@supabase/supabase-js';

export async function runScheduler(query: URLSearchParams) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!supabaseUrl || !serviceKey) return { status: 500, body: { error: 'Missing SUPABASE env vars' } };

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const mode = query.get('mode') ?? 'reschedule_all';

  if (mode === 'reschedule_all') {
    // Call DB scheduler (Oct 24 working version)
    const { data, error } = await supabase.rpc('scheduler_resource_fill_optimized');
    if (error) return { status: 500, body: { error: 'scheduler_resource_fill_optimized failed', detail: error } };
    
    return { 
      status: 200, 
      body: { 
        ok: true, 
        wrote_slots: data.wrote_slots,
        updated_jsi: data.updated_jsi,
        violations: data.violations 
      } 
    };
  }

  return { status: 400, body: { error: 'Unknown mode' } };
}
