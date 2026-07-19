"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markDayRead } from "@/app/(app)/olvasas/actions";
import { Button } from "@/components/ui/Button";

interface Props {
  dayIdx: number;
  minutes: number;
  mode: string;
}

export function ReadingSessionCTA({ dayIdx, minutes, mode }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function go() {
    setPending(true);
    await markDayRead(dayIdx, minutes);
    router.push(`/ma/session?mode=${mode}`);
  }

  return (
    <Button size="lg" onClick={go} disabled={pending}>
      Készen állok → Ismétlés indítása
    </Button>
  );
}
