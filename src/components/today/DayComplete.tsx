import { Confetti } from "@/components/ui/Confetti";
import { ButtonLink } from "@/components/ui/Button";

interface Props {
  todayXp: number;
  streak: number;
}

/** The "you did it" card that replaces the CTA once every step is done. */
export function DayComplete({ todayXp, streak }: Props) {
  return (
    <section className="relative mt-2">
      <Confetti />
      <div className="pop-in shine relative rounded-3xl border-2 border-gold/50 bg-gold/15 p-6 text-center">
        <p className="text-5xl">🏆</p>
        <p className="mt-2 text-2xl font-black text-ink">Mai nap kész!</p>
        <p className="mt-1 text-sm font-bold text-ink-muted">
          +{todayXp} XP
          {streak > 0 ? ` · ${streak} napos sorozat 🔥` : ""}
        </p>
        <ButtonLink size="md" variant="gold" href="/ma/session?mode=short" className="mt-5 w-full">
          Extra kör (10 perc)
        </ButtonLink>
      </div>
    </section>
  );
}
