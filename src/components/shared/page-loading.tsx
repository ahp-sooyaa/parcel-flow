import { PageContentSkeleton } from "@/components/shared/page-content-skeleton";

/** @deprecated Prefer PageContentSkeleton — kept for existing imports/tests. */
export function PageLoading() {
  return <PageContentSkeleton variant="block" />;
}
