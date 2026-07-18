import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-6">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="mt-2 h-4 w-32" />

      <Skeleton className="mt-6 h-3 w-20" />
      <div className="mt-2 grid grid-cols-11 gap-1">
        {Array.from({ length: 66 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full" />
        ))}
      </div>

      <Skeleton className="mt-8 h-3 w-32" />
      <Skeleton className="mt-2 h-20 w-full" />

      <Skeleton className="mt-8 h-16 w-full" />
    </main>
  );
}
