import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 signs the rider out; retrying other errors once covers flaky mobile data.
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof Error && "status" in error && error.status === 401),
    },
  },
});
