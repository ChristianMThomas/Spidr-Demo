import { useState, useEffect } from "react";

interface BetaStatus {
  count: number;
  spotsLeft: number;
  isFull: boolean;
  cap: number;
}

const BETA_API = import.meta.env.VITE_BETA_API_URL || "http://localhost:3001";
const POLL_MS = 15_000;

export function useBetaStatus() {
  const [status, setStatus] = useState<BetaStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch(`${BETA_API}/status`);
        if (!res.ok) return;
        const data: BetaStatus = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        // silently ignore — counter just doesn't show until next poll
      }
    }

    fetchStatus();
    const id = setInterval(fetchStatus, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return status;
}
