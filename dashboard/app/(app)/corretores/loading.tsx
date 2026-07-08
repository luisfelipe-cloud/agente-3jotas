import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

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

      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} variant="elevated" className="space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-8" />
              </div>
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                  <Skeleton className="h-1.5 w-full" />
                </div>
              ))}
            </div>

            <Skeleton className="h-4 w-28" />
          </Card>
        ))}
      </div>
    </div>
  );
}
