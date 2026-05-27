import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

/**
 * Canonical 1:1 DM conversation id. Both participants resolve to the SAME id
 * regardless of order. Use this everywhere a DM conversation id is needed so
 * messages don't land in mismatched conversations (the cause of the
 * "sling to DMs doesn't work" bug — different call sites used '_' vs '-').
 */
export function dmConversationId(a, b) {
  return [String(a), String(b)].sort().join('-');
}
