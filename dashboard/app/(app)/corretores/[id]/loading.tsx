import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56 mt-1.5" />
        <Skeleton className="h-4 w-64 mt-1.5" />
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
        <Skeleton className="h-8 w-52 rounded-full" />
      </div>

      <Card variant="elevated">
        <Skeleton className="h-3 w-56 mb-4" />
        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </Card>

      <Card variant="elevated" className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
      </Card>

      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="elevated" className="!rounded-md border-l-4 border-l-gray-200">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Skeleton key={j} className="h-2.5 w-2.5 rounded-full" />
                  ))}
                </div>
                <Skeleton className="h-3 w-3" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
