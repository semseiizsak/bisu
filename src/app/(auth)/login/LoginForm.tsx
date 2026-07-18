"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const searchParams = useSearchParams();
  const notAllowed = searchParams.get("error") === "not_allowed";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Biblia Mastery</h1>
      <p className="mt-2 text-ink-muted">Jelentkezz be a folytatáshoz.</p>

      {notAllowed && (
        <p className="mt-6 rounded-md border border-line-strong bg-surface px-4 py-3 text-sm text-bad">
          Ez a fiók nem jogosult a belépésre.
        </p>
      )}

      {status === "sent" ? (
        <p className="mt-8 rounded-md border border-line bg-surface px-4 py-4 text-ink">
          Elküldtük a belépési linket a <strong className="font-extrabold">{email}</strong> címre.
          Nyisd meg a leveledet.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <Input
            type="email"
            required
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Küldés…" : "Belépési link küldése"}
          </Button>
          {status === "error" && (
            <p className="text-sm text-bad">Nem sikerült elküldeni a linket. Próbáld újra.</p>
          )}
        </form>
      )}
    </div>
  );
}
