import React from 'react';
import { useAppShell } from '@/context/AppShellContext';
import AIPanel from '@/components/spidr/AIPanel';

/** /ai — Spidr AI chat panel. */
export default function AIPage() {
  const { currentUser } = useAppShell();
  return <AIPanel currentUser={currentUser} />;
}
