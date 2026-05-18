import React from 'react';
import { useAppShell } from '@/context/AppShellContext';
import ModuleNexus from '@/components/nexus/ModuleNexus';

/** /modules — Module Nexus widget marketplace. */
export default function ModulesPage() {
  const { currentUser } = useAppShell();
  return <ModuleNexus currentUser={currentUser} />;
}
