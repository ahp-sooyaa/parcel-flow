import { mobileMeResponseSchema } from "@parcel-flow/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { apiGet } from "@/api/client";

export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => apiGet("/me", mobileMeResponseSchema),
});

export function useMe() {
  return useQuery(meQueryOptions);
}
