"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reconcileXp, type XpSummary } from "@/lib/xp/reconcile";

/**
 * Called once when a quiz or game round finishes: recompute XP and drop
 * the client router cache for the pages whose numbers just changed, so
 * the 30s stale window (next.config.ts) never shows yesterday's ring.
 */
export async function finishSession(dayIdx: number | null): Promise<XpSummary> {
  const supabase = await createClient();
  const summary = await reconcileXp(supabase, dayIdx);
  revalidatePath("/ma");
  revalidatePath("/haladas");
  return summary;
}
