"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** The owner's own trusted-preacher list for sermon recommendations. */
export async function addPreacher(input: { name: string; channel_id?: string; query_modifier?: string }): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("preachers").insert({
    name: input.name.trim(),
    channel_id: input.channel_id?.trim() || null,
    query_modifier: input.query_modifier?.trim() || "",
  });
  if (error) throw error;
  revalidatePath("/prediktorok");
}

export async function setPreacherEnabled(id: number, enabled: boolean): Promise<void> {
  const supabase = await createClient();
  await supabase.from("preachers").update({ enabled }).eq("id", id);
  revalidatePath("/prediktorok");
}

export async function removePreacher(id: number): Promise<void> {
  const supabase = await createClient();
  await supabase.from("preachers").delete().eq("id", id);
  revalidatePath("/prediktorok");
}
