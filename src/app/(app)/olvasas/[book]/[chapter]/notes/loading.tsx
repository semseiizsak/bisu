import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </main>
  );
}
