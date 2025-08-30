// supabase/functions/scheduler-run/index.ts
// Production wrapper for the scheduler with strict payload validation.
// It is defensive against bad UUIDs (fixes 22P02: invalid input syntax for type uuid).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

type ScheduleRequest = {
  commit?: boolean
  proposed?: boolean
  onlyIfUnset?: boolean
  nuclear?: boolean
  wipeAll?: boolean
  startFrom?: string | null
  // optional restriction to specific jobs
  onlyJobIds?: string[] | string | null
}

type ScheduleResult = {
  ok: true
  jobs_considered: number
  scheduled: number
  applied: { updated: number }
  note?: string
}

type ScheduleError = {
  ok: false
  code: string
  message: string
  details?: unknown
}

const ALLOW_ORIGINS = [
  'https://preview--print-batch-flow.lovable.app',
  'https://print-batch-flow.lovable.app',
  // add more if you use other environments
]

/** RFC4122 v1–v5 UUID checker (strict) */
function isUUID(v: unknown): v is string {
  if (typeof v !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  )
}

/** Normalise onlyJobIds to a *valid* array of UUIDs or undefined */
function normaliseOnlyJobIds(input: ScheduleRequest['onlyJobIds']): string[] | undefined {
  if (input == null) return undefined
  const arr = Array.isArray(input) ? input : [input]
  const valid = arr.filter(isUUID)
  return valid.length ? valid : undefined
}

/** Basic next-working-start normaliser (Mon–Fri 08:00, skips weekends). */
function normaliseStartFrom(raw: string | null | undefined): string {
  const now = new Date()
  let d = raw ? new Date(raw) : now

  // Snap into the future if caller sent a past time
  if (d.getTime() < now.getTime()) d = now

  // force to 08:00 local time
  d.setSeconds(0, 0)
  d.setHours(8, 0, 0, 0)

  // roll forward if weekend
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
  }
  return d.toISOString()
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
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors(req.headers.get('Origin')) })
  }

  const headers = cors(req.headers.get('Origin'))

  try {
    const payload = (await req.json()) as ScheduleRequest

    // ---- Validate/sanitise inputs (fix for 22P02) ----
    const onlyJobIds = normaliseOnlyJobIds(payload.onlyJobIds)
    if (Array.isArray(payload.onlyJobIds) || typeof payload.onlyJobIds === 'string') {
      // Caller attempted to restrict. If none survived validation, refuse with 400
      if (!onlyJobIds) {
        const body: ScheduleError = {
          ok: false,
          code: 'BAD_ONLY_JOB_IDS',
          message:
            'onlyJobIds was provided but contained no valid UUIDs. Refusing to run.',
        }
        return new Response(JSON.stringify(body), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
    }

    const body: Required<ScheduleRequest> = {
      commit: Boolean(payload.commit),
      proposed: Boolean(payload.proposed),
      onlyIfUnset: Boolean(payload.onlyIfUnset),
      nuclear: Boolean(payload.nuclear),
      wipeAll: Boolean(payload.wipeAll),
      startFrom: normaliseStartFrom(payload.startFrom ?? null),
      onlyJobIds: onlyJobIds ?? undefined,
    }

    // Create service client
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    // If wipeAll/nuclear, clear slots before compute
    if (body.nuclear || body.wipeAll) {
      const { error } = await sb.from('stage_time_slots').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (error) {
        console.error('wipeAll failed', error)
        const err: ScheduleError = { ok: false, code: 'WIPE_FAILED', message: error.message, details: error }
        return new Response(JSON.stringify(err), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
    }

    // ---- SELECT candidate jobs; *never* send bad UUIDs to the DB ----
    let q = sb.from('production_jobs')
      .select('id, wo_no, status, proof_approved_at')
      .is('deleted_at', null)

    if (body.onlyJobIds) {
      q = q.in('id', body.onlyJobIds)
    } else {
      // typical “rebuild” filter; adjust to your needs
      q = q.not('status', 'eq', 'completed').order('proof_approved_at', { ascending: true })
    }

    const { data: jobs, error: jobsErr } = await q
    if (jobsErr) {
      console.error('select jobs failed', jobsErr)
      const err: ScheduleError = {
        ok: false, code: 'SELECT_JOBS_FAILED', message: jobsErr.message, details: jobsErr,
      }
      return new Response(JSON.stringify(err), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // === YOUR actual scheduling engine goes here =========================
    // For safety, the block below is a minimal stub that does nothing but
    // returns success. Replace IMPLEMENT_ME with your working algorithm
    // when ready, it will *never* see invalid UUIDs now.
    // ====================================================================
    const result: ScheduleResult = {
      ok: true,
      jobs_considered: jobs?.length ?? 0,
      scheduled: 0,
      applied: { updated: 0 },
      note: 'Stub ran; payload validated and DB reachable.',
    }
    // ====================================================================

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('scheduler-run fatal:', e)
    const err: ScheduleError = {
      ok: false,
      code: 'UNEXPECTED',
      message: e?.message ?? String(e),
      details: e,
    }
    return new Response(JSON.stringify(err), {
      status: 500,
      headers: { ...cors(req.headers.get('Origin')), 'Content-Type': 'application/json' },
    })
  }
})
