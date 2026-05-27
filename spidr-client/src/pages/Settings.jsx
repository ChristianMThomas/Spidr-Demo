import React from 'react';
import { useAppShell } from '@/context/AppShellContext';
import SettingsPanel from '@/components/spidr/SettingsPanel';

/** /settings — user settings. */
export default function SettingsPage() {
  const { currentUser, appTheme, setAppTheme } = useAppShell();
  return <SettingsPanel currentUser={currentUser} appTheme={appTheme} onThemeChange={setAppTheme} />;
}
