import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-9 w-32" />
        </div>
        <Skeleton className="h-12 w-20 rounded-2xl" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-2xl" />
        <Skeleton className="h-3 flex-1 rounded-full" />
      </div>

      <div className="mt-6 flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-2 h-4 w-40" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="mt-8 h-14 w-full rounded-2xl" />
    </main>
  );
}
