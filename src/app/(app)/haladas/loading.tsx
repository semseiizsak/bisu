import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-3xl" />
        <div className="flex-1">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-2 h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-full rounded-full" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-8 h-6 w-24" />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mx-auto h-[76px] w-[76px] rounded-full" />
        ))}
      </div>
    </main>
  );
}
