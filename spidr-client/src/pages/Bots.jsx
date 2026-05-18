import React from 'react';
import { useAppShell } from '@/context/AppShellContext';
import BotLaboratory from '@/components/spidr/BotLaboratory';

/** /bots — Bot Laboratory. */
export default function BotsPage() {
  const { currentUser } = useAppShell();
  return <BotLaboratory currentUser={currentUser} />;
}
