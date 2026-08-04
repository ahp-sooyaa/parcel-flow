export function PageLoading() {
  return (
    <div className="space-y-4" data-testid="page-loading">
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
      <div className="mt-6 h-64 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
