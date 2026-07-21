"use server";

import { createClient } from "@/lib/supabase/server";
import { reconcileXp, type XpSummary } from "@/lib/xp/reconcile";

export async function getXpSummary(dayIdx: number | null): Promise<XpSummary> {
  const supabase = await createClient();
  return reconcileXp(supabase, dayIdx);
}
