import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56 mt-1.5" />
        <Skeleton className="h-4 w-72 mt-1.5" />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-14 mt-2" />
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-16" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="elevated" className="!rounded-md">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-32" />
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-8 w-12" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
