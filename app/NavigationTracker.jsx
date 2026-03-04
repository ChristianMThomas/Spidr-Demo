'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';

const PAGE_MAP = {
  '/': 'Home',
  '/GifsEmojis': 'GifsEmojis',
  '/GlobalReports': 'GlobalReports',
  '/SeedFriends': 'SeedFriends',
};

export default function NavigationTracker() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const pageName = PAGE_MAP[pathname] ?? null;
    if (isAuthenticated && pageName) {
      base44.appLogs.logUserInApp(pageName).catch(() => {});
    }
  }, [pathname, isAuthenticated]);

  return null;
}
