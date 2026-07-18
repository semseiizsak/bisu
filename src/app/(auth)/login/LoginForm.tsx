"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const notAllowed = searchParams.get("error") === "not_allowed";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(true);
      setSubmitting(false);
      return;
    }
    router.push("/ma");
    router.refresh();
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

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
        <Input
          type="email"
          required
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <Input
          type="password"
          required
          placeholder="Jelszó"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Belépés…" : "Belépés"}
        </Button>
        {error && <p className="text-sm text-bad">Hibás email vagy jelszó.</p>}
      </form>
    </div>
  );
}
