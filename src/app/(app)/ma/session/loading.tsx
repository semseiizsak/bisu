import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <Skeleton className="h-4 w-16" />
      <div className="mt-4 flex flex-col gap-4">
        <Skeleton className="h-1 w-full" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </main>
  );
}
