"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveFact(id: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("facts").update({ verified: true }).eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/facts");
}

export async function updateFact(id: number, fact_value: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("facts")
    .update({ fact_value, verified: true })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/admin/facts");
}
