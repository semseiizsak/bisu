"use server";

import { createClient } from "@/lib/supabase/server";

export async function acknowledgeBadges(ids: string[]) {
  if (!ids.length) return;
  const supabase = await createClient();
  await supabase.from("badges").update({ seen_at: new Date().toISOString() }).in("id", ids);
}
