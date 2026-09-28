"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markDayRead } from "@/lib/actions/questions";
import { Button } from "@/components/ui/Button";

interface Props {
  dayIdx: number;
  minutes: number;
  mode: string;
}

/** Last step of the day's reading: marks the plan day done (the plan
 * advances from here, not from the calendar) and hands over to the quiz. */
export function ReadingSessionCTA({ dayIdx, minutes, mode }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function go() {
    setPending(true);
    try {
      await markDayRead(dayIdx, minutes);
      router.push(`/ma/session?mode=${mode}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="lg" onClick={go} disabled={pending}>
      {pending ? "Mentés…" : "Olvasás kész → Ismétlés indítása"}
    </Button>
  );
}
