import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/*
  Scheduler settings
  Actions:
    - get_version: returns { ok: true, version: 1 | 2 }
    - set_version: body.version in {1,2} -> persists in app_settings
  Storage:
    app_settings(setting_type='scheduler_version', product_type='global', sla_target_days=1|2)
*/
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === 'get_version') {
      const { data, error } = await supabase
        .from('app_settings')
        .select('sla_target_days')
        .eq('setting_type', 'scheduler_version')
        .eq('product_type', 'global')
        .maybeSingle();

      if (error) {
        console.error('[scheduler-settings] get_version error', error);
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const v = (data?.sla_target_days as number | null) ?? 2;
      const version = v === 1 ? 1 : 2;
      console.log(`[scheduler-settings] get_version -> ${version}`);
      return new Response(JSON.stringify({ ok: true, version }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (action === 'set_version') {
      const desired = Number(body.version);
      if (desired !== 1 && desired !== 2) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid version' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      // Check if exists
      const { data: existing, error: selErr } = await supabase
        .from('app_settings')
        .select('id')
        .eq('setting_type', 'scheduler_version')
        .eq('product_type', 'global')
        .maybeSingle();

      if (selErr) {
        console.error('[scheduler-settings] set_version select error', selErr);
        return new Response(JSON.stringify({ ok: false, error: selErr.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      if (existing?.id) {
        const { error: updErr } = await supabase
          .from('app_settings')
          .update({ sla_target_days: desired })
          .eq('id', existing.id);
        if (updErr) {
          console.error('[scheduler-settings] set_version update error', updErr);
          return new Response(JSON.stringify({ ok: false, error: updErr.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      } else {
        const { error: insErr } = await supabase
          .from('app_settings')
          .insert({ setting_type: 'scheduler_version', product_type: 'global', sla_target_days: desired });
        if (insErr) {
          console.error('[scheduler-settings] set_version insert error', insErr);
          return new Response(JSON.stringify({ ok: false, error: insErr.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        }
      }

      console.log(`[scheduler-settings] set_version -> ${desired}`);
      return new Response(JSON.stringify({ ok: true, version: desired }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Unsupported action' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    console.error('[scheduler-settings] error', e);
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'unknown' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
