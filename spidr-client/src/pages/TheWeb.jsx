import React from 'react';
import { useAppShell } from '@/context/AppShellContext';
import FeedPanel from '@/components/spidr/FeedPanel';
import ThemedPage from '@/components/spidr/ThemedPage';

/** /feed — "THE WEB" short-form video feed (TikTok-style). */
export default function TheWebPage() {
  const { currentUser } = useAppShell();
  return <ThemedPage><FeedPanel currentUser={currentUser} /></ThemedPage>;
}
