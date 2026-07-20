// Canonical 1:1 DM conversation id. Both participants resolve to the SAME id
// regardless of order — same rule as the web client.
export function dmConversationId(a: string, b: string) {
  return [String(a), String(b)].sort().join('-');
}

export function formatTimestamp(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString();
}
