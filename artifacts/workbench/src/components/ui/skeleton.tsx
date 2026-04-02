import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <div className="w-[220px] shrink-0 bg-card border-r border-card-border p-4 min-h-screen">
          <Skeleton className="h-6 w-28 mb-8" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-24 ml-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl bg-card border border-card-border p-4", className)}>
      <Skeleton className="h-4 w-1/3 mb-3" />
      <Skeleton className="h-3 w-2/3 mb-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl bg-card border border-card-border overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border">
        <Skeleton className="h-4 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-card-border last:border-0 flex items-center gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export { Skeleton, PageSkeleton, CardSkeleton, TableSkeleton }
