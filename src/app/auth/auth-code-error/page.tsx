import Link from "next/link";

export default function AuthCodeError() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-extrabold text-ink">A link lejárt vagy érvénytelen</h1>
      <p className="mt-2 text-ink-muted">Kérj egy új belépési linket.</p>
      <Link href="/login" className="mt-6 font-extrabold text-accent underline underline-offset-4">
        Vissza a bejelentkezéshez
      </Link>
    </main>
  );
}
