import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-8">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="mt-2 h-4 w-40" />
      <Skeleton className="mt-2 h-1.5 w-full" />

      <div className="mt-6 flex flex-col gap-2 rounded-lg border border-line p-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-14 w-full" />
        <Skeleton className="mt-3 h-11 w-full" />
      </div>
    </main>
  );
}
