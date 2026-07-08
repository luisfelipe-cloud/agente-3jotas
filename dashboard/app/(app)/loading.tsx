import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56 mt-1.5" />
      </div>

      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-3 w-96" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-14 mt-2" />
            <Skeleton className="h-3 w-20 mt-1.5" />
          </Card>
        ))}
      </div>

      <Card>
        <Skeleton className="h-4 w-44 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Skeleton className="h-4 w-56 mb-4" />
        <Skeleton className="h-48 w-full" />
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="space-y-3">
            <Skeleton className="h-4 w-32 mb-1" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-start justify-between gap-3 pb-3 border-b border-border last:border-0">
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full shrink-0" />
              </div>
            ))}
          </Card>
        ))}
      </div>
    </div>
  );
}
