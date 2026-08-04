export function PageContentSkeleton({
  variant = "block",
}: Readonly<{ variant?: "block" | "table" | "cards" }>) {
  if (variant === "cards") {
    return (
      <div className="space-y-6" data-testid="page-loading">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="space-y-3" data-testid="page-loading">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="rounded-lg border bg-white">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="h-12 border-b border-border/60 animate-pulse bg-muted/40 last:border-b-0"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="page-loading">
      <div className="h-64 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
