import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppShell } from '@/context/AppShellContext';
import SignalRadar from '@/components/spidr/SignalRadar';

/**
 * /radar — Signal Radar.
 *
 * Discovery stays inside the persistent shell, including its sidebar.
 */
export default function RadarPage() {
  const { currentUser } = useAppShell();
  const navigate = useNavigate();

  return (
    <div className="flex-1 bg-black/40 relative">
      <SignalRadar
        open={true}
        onClose={() => navigate('/home')}
        currentUser={currentUser}
      />
    </div>
  );
}
