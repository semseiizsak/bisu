import { BottomNav } from "@/components/nav/BottomNav";

// Every page under here reads live learner state; nothing is prerenderable.
// (The old cookie-based Supabase client made this implicit.)
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1 pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}
