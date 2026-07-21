import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadReviewCards } from "@/lib/review/load-cards";
import { PracticeVerse } from "@/components/verse/PracticeVerse";

export default async function PracticeVersePage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const id = Number(cardId);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const [card] = await loadReviewCards(supabase, [id]);
  if (!card || card.type !== "verse") notFound();

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-6">
      <PracticeVerse card={card} />
    </main>
  );
}
