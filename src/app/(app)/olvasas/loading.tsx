import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <div className="flex items-end justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="mt-2 h-3 w-full rounded-full" />
      <Skeleton className="mt-5 h-52 w-full rounded-3xl" />
      <Skeleton className="mt-4 h-14 w-full rounded-2xl" />
    </main>
  );
}
