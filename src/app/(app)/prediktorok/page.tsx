import { createClient } from "@/lib/supabase/server";
import { PreacherList } from "@/components/sermons/PreacherList";

export default async function PreachersPage() {
  const supabase = await createClient();
  const { data: preachers } = await supabase.from("preachers").select("id, name, channel_id, query_modifier, enabled").order("name");

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-6">
      <h1 className="text-2xl font-extrabold text-ink">Prédikátorok</h1>
      <p className="mt-1 text-sm text-ink-muted">
        A &bdquo;Kapcsolódó tanítások&rdquo; ezekből a forrásokból keres YouTube-videókat az olvasott fejezet témájához.
      </p>

      <div className="mt-6">
        <PreacherList preachers={preachers ?? []} />
      </div>
    </main>
  );
}
