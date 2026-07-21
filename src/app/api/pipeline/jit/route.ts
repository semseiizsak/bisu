import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runJitPipeline } from "@/lib/pipeline/run";

export const maxDuration = 60;

async function isAuthorized(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

/** Vercel cron target (see vercel.json) + manual catch-up:
 * curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/pipeline/jit */
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return new NextResponse(null, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  const admin = createAdminClient();
  try {
    const summary = await runJitPipeline(admin, process.env.OPENAI_API_KEY);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
