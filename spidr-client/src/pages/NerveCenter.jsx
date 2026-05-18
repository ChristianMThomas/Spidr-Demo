import React from 'react';
import { useAppShell } from '@/context/AppShellContext';
import NerveCenter from '@/components/spidr/NerveCenter';

/** /nerve-center — personal stats dashboard. */
export default function NerveCenterPage() {
  const { currentUser } = useAppShell();
  return <NerveCenter currentUser={currentUser} />;
}
