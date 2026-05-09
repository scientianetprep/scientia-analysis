import { cn } from "@/lib/utils";

/** Base shimmer pulse element */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-container-high",
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-surface-container-highest/60 to-transparent animate-shimmer duration-[2s]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Overview Skeleton
// ---------------------------------------------------------------------------

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="space-y-2">
        <Shimmer className="h-5 w-56" />
        <Shimmer className="h-3.5 w-40" />
      </div>

      {/* Stat tiles — 3-up compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="surface-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Shimmer className="h-6 w-6" />
              <Shimmer className="h-3 w-10" />
            </div>
            <Shimmer className="h-5 w-16" />
            <Shimmer className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Activity + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 surface-card p-3 space-y-2">
          <Shimmer className="h-4 w-36 mb-2" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 py-1.5">
              <Shimmer className="h-7 w-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Shimmer className="h-3 w-full" />
                <Shimmer className="h-2.5 w-2/3" />
              </div>
              <Shimmer className="h-6 w-14 shrink-0" />
            </div>
          ))}
        </div>
        <div className="surface-card p-3 space-y-2">
          <Shimmer className="h-4 w-28 mb-2" />
          {[1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Courses Page Skeleton
// ---------------------------------------------------------------------------

export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card overflow-hidden flex flex-col">
          <Shimmer className="aspect-video w-full rounded-none" />
          <div className="p-3 space-y-2 flex-1">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-3 w-5/6" />
            <Shimmer className="h-3 w-4/6" />
            <div className="pt-2 flex justify-between">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-3 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests Page Skeleton
// ---------------------------------------------------------------------------

export function TestGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface-card p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Shimmer className="h-9 w-9 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-3 w-20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Shimmer className="h-8" />
            <Shimmer className="h-8" />
          </div>
          <Shimmer className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Page Skeleton
// ---------------------------------------------------------------------------

export function HistoryListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="surface-card divide-y divide-outline-variant/10 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shimmer className="w-8 h-8 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Shimmer className="h-3.5 w-40" />
              <div className="flex items-center gap-2">
                <Shimmer className="h-3 w-14 rounded-full" />
                <Shimmer className="h-3 w-24" />
              </div>
            </div>
          </div>
          <Shimmer className="h-8 w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Page Skeleton
// ---------------------------------------------------------------------------

export function SettingsSkeleton() {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="space-y-2">
        <Shimmer className="h-6 w-48" />
        <Shimmer className="h-3.5 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="surface-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shimmer className="h-6 w-6" />
              <Shimmer className="h-4 w-32" />
            </div>
            <Shimmer className="h-14 w-full" />
            <Shimmer className="h-9 w-full" />
            <Shimmer className="h-9 w-full" />
            <Shimmer className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile Page Skeleton
// ---------------------------------------------------------------------------

export function ProfileSkeleton() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="space-y-2">
        <Shimmer className="h-6 w-72" />
        <Shimmer className="h-3.5 w-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="surface-card p-4 flex flex-col items-center gap-3">
            <Shimmer className="w-20 h-20 rounded-full" />
            <Shimmer className="h-5 w-36" />
            <Shimmer className="h-3 w-24 rounded-full" />
            <Shimmer className="h-9 w-full" />
            <Shimmer className="h-9 w-full" />
          </div>
          <div className="surface-card p-4 space-y-2">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-10 w-full" />
            <Shimmer className="h-3 w-16 rounded-full" />
          </div>
        </div>
        {/* Main */}
        <div className="lg:col-span-8 space-y-3">
          <div className="surface-card p-4 space-y-3">
            <Shimmer className="h-5 w-36" />
            <div className="grid grid-cols-2 gap-3">
              <Shimmer className="h-20" />
              <Shimmer className="h-20" />
            </div>
          </div>
          <div className="surface-card p-4 space-y-3">
            <Shimmer className="h-5 w-36" />
            <Shimmer className="h-[220px] w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
