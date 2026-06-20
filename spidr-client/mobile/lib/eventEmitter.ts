type Handler = (detail?: any) => void;

const listeners = new Map<string, Set<Handler>>();

export const emitter = {
  on(event: string, handler: Handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
    return () => emitter.off(event, handler);
  },
  off(event: string, handler: Handler) {
    listeners.get(event)?.delete(handler);
  },
  emit(event: string, detail?: any) {
    listeners.get(event)?.forEach((h) => {
      try { h(detail); } catch { /* swallow */ }
    });
  },
};
