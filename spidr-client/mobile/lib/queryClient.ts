import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Never retry a 4xx — a 404/403 won't become a 200 on the second try,
      // and retrying just stretches the wait before a "not found" can render.
      // Server errors and network blips still get one retry.
      retry: (failureCount: number, error: any) => {
        const status = error?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
