import React from 'react';
import { useAppShell } from '@/context/AppShellContext';
import AdminPanel from '@/components/spidr/AdminPanel';

/** /admin — platform admin console. Server enforces access; client hides
 *  UI for non-admins so the interface never 403s in their face. */
export default function AdminPage() {
  const { currentUser } = useAppShell();
  return <AdminPanel currentUser={currentUser} />;
}
