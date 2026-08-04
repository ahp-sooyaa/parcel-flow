export function DashboardShellFallback() {
  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden w-64 shrink-0 border-r bg-[#fafaf8] lg:block" />
      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-4 sm:px-6" />
        <main className="p-4 sm:p-6">
          <div className="space-y-4">
            <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-muted" />
            <div className="mt-6 h-64 animate-pulse rounded-md bg-muted" />
          </div>
        </main>
      </div>
    </div>
  );
}
