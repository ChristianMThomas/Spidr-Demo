import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/**
 * Canonical 1:1 DM conversation id. Both participants resolve to the SAME id
 * regardless of argument order, so a message sent from any surface (sling,
 * friends list, profile) lands in the conversation the DM view reads.
 * Canonical format is the sorted ids joined by '-' (matches AppShell,
 * FriendsPanel and HolographicProfile).
 */
export function dmConversationId(a, b) {
  return [a, b].filter(Boolean).sort().join('-');
}
