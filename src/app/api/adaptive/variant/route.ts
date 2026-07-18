import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { maybeCreateVariant } from "@/lib/adaptive/apply-variant";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const body = (await request.json().catch(() => null)) as { cardId?: number } | null;
  const cardId = body?.cardId;
  if (typeof cardId !== "number") return new NextResponse(null, { status: 400 });

  try {
    const admin = createAdminClient();
    await maybeCreateVariant(admin, cardId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
