import { Card } from "@/components/ui/Card";

export function CoachReport({ body }: { body: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-extrabold uppercase tracking-wide text-accent">Heti edző</p>
      <div className="mt-2 whitespace-pre-line text-sm text-ink">{body}</div>
    </Card>
  );
}
