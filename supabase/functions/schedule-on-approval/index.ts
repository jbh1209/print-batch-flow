// supabase/functions/schedule-on-approval/index.ts
// Small proxy that forwards to scheduler-run, with UUID validation to prevent "".

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const SCHEDULER_PATH = '/functions/v1/scheduler-run'

const ALLOW_ORIGINS = [
  'https://preview--print-batch-flow.lovable.app',
  'https://print-batch-flow.lovable.app',
]

function isUUID(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  )
}

function cors(origin: string | null) {
  const allow =
    !origin || ALLOW_ORIGINS.includes(origin)
      ? origin ?? '*'
      : 'null'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors(req.headers.get('Origin')) })
  }

  const headers = { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' }

  try {
    const raw = await req.json().catch(() => ({})) as Record<string, unknown>
    const baseUrl = Deno.env.get('SUPABASE_URL')!

    // normalise onlyJobIds coming from triggers/UI
    let onlyJobIds: string[] | undefined
    if (raw.onlyJobIds != null) {
      const arr = Array.isArray(raw.onlyJobIds) ? raw.onlyJobIds : [raw.onlyJobIds]
      onlyJobIds = arr.filter(isUUID)
      if (Array.isArray(raw.onlyJobIds) || typeof raw.onlyJobIds === 'string') {
        if (!onlyJobIds.length) {
          return new Response(
            JSON.stringify({
              ok: false,
              code: 'BAD_ONLY_JOB_IDS',
              message:
                'onlyJobIds was provided to proxy but contained no valid UUIDs.',
            }),
            { status: 400, headers },
          )
        }
      }
    }

    const body = {
      commit: !!raw.commit,
      proposed: !!raw.proposed,
      onlyIfUnset: !!raw.onlyIfUnset,
      nuclear: !!raw.nuclear,
      wipeAll: !!raw.wipeAll,
      startFrom: (raw.startFrom as string | undefined) ?? null,
      onlyJobIds,
    }

    const res = await fetch(`${baseUrl}${SCHEDULER_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // IMPORTANT: your service role key is not required here if this function
        // is **invoking another function** within the same project.
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    return new Response(text, { status: res.status, headers })
  } catch (e) {
    console.error('schedule-on-approval fatal:', e)
    return new Response(
      JSON.stringify({ ok: false, code: 'UNEXPECTED', message: String(e) }),
      { status: 500, headers },
    )
  }
})
