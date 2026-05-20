import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppShell } from '@/context/AppShellContext';
import SignalRadar from '@/components/spidr/SignalRadar';

/**
 * /radar — Signal Radar.
 *
 * The underlying component is built as a modal (it has `open`/`onClose` props
 * because it can also be opened from the sidebar dock as a popover). When
 * routed to /radar we render it inline as a full page by passing `open={true}`
 * and routing `onClose` back to /home.
 */
export default function RadarPage() {
  const { currentUser } = useAppShell();
  const navigate = useNavigate();

  return (
    <div className="flex-1 bg-black relative">
      <SignalRadar
        open={true}
        onClose={() => navigate('/home')}
        currentUser={currentUser}
      />
    </div>
  );
}
