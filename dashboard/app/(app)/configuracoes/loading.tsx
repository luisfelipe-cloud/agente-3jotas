import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-96 mt-2" />
      </div>

      <div className="inline-flex rounded-full bg-gray-50 p-1 gap-1">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-80" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20 ml-auto" />
          <Skeleton className="h-1.5 w-32" />
        </div>
      </div>

      <Card className="!p-0 divide-y divide-border overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-full max-w-md" />
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
