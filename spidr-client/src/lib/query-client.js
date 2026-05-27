import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Treat data as fresh for 30s so navigation/remounts don't refetch
			// instantly. Socket events still force-invalidate when data changes.
			staleTime: 30000,
		},
	},
});