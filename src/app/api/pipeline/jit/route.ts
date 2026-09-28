import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runJitPipeline, type ChapterTarget } from "@/lib/pipeline/run";
import { BOOKS } from "@/lib/content/books";

export const maxDuration = 60;

function parseTargets(body: unknown): ChapterTarget[] {
  const raw = (body as { chapters?: unknown } | null)?.chapters;
  if (!Array.isArray(raw)) return [];
  const out: ChapterTarget[] = [];
  for (const item of raw.slice(0, 10)) {
    const slug = (item as { book?: unknown })?.book;
    const chapter = Number((item as { chapter?: unknown })?.chapter);
    if (typeof slug !== "string" || !BOOKS.some((b) => b.slug === slug) || !Number.isInteger(chapter) || chapter < 1) continue;
    out.push({ book_slug: slug, chapter });
  }
  return out;
}

/**
 * Vercel cron target (see vercel.json) and on-demand generation from the
 * reader. Body may carry explicit chapters:
 *   { "chapters": [{ "book": "genesis", "chapter": 4 }] }
 * Open like the rest of the app; cost is bounded because every chapter is
 * generated at most once (extraction_runs), so the worst an outsider can
 * do is generate content early.
 */
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  const body = await request.json().catch(() => null);
  const explicit = parseTargets(body);

  const admin = await createClient();
  try {
    const summary = await runJitPipeline(admin, process.env.OPENAI_API_KEY, explicit);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
