import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildWeeklyReport } from "@/lib/weekly-report";

export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "report_not_configured" }, { status: 503, headers });
  }

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const db = getAdminSupabase();
  if (!db) {
    return NextResponse.json({ error: "report_not_configured" }, { status: 503, headers });
  }

  try {
    return NextResponse.json(await buildWeeklyReport(db), { headers });
  } catch {
    return NextResponse.json({ error: "report_unavailable" }, { status: 502, headers });
  }
}
