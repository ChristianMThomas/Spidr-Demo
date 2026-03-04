'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { AuthProvider } from '@/lib/AuthContext';
import { MenuProvider } from '@/components/MenuContext';
import { Toaster } from 'sonner';
import SpidrMenu from '@/components/ui/SpidrMenu';
import NavigationTracker from './NavigationTracker';

export function Providers({ children }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <MenuProvider>
          <NavigationTracker />
          {children}
          <SpidrMenu />
          <Toaster
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                background: '#18181b',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                color: '#fff',
              },
            }}
          />
        </MenuProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
