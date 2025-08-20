// app/api/scheduler/run/route.ts
import { NextResponse } from 'next/server';
import { runScheduler } from '../../../../tracker/schedule-board/apiHandler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { status, body } = await runScheduler(searchParams);
  return NextResponse.json(body, { status });
}
