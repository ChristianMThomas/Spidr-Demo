/**
 * Guarded access to the native call modules (react-native-webrtc,
 * react-native-callkeep, @react-native-firebase/messaging,
 * react-native-incall-manager).
 *
 * These only exist in a custom dev client / EAS build — requiring them in
 * Expo Go throws at import time. Everything call-related must go through
 * these lazy getters so the rest of the app keeps working in Expo Go
 * (calls then degrade to the "needs dev build" message).
 */

function safeRequire(name: string): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    switch (name) {
      case 'webrtc': return require('react-native-webrtc');
      case 'callkeep': return require('react-native-callkeep').default;
      case 'messaging': return require('@react-native-firebase/messaging').default;
      case 'incall': return require('react-native-incall-manager').default;
      // Expo module — unlike the four above it DOES exist in Expo Go, which
      // is the whole point: it can raise the OS notification dialog there.
      case 'expoNotifications': return require('expo-notifications');
      default: return null;
    }
  } catch {
    return null;
  }
}

const cache: Record<string, any> = {};
function mod(name: string) {
  if (!(name in cache)) cache[name] = safeRequire(name);
  return cache[name];
}

export const getWebRTC = () => mod('webrtc');       // { RTCPeerConnection, RTCIceCandidate, mediaDevices, RTCView, ... }
export const getCallKeep = () => mod('callkeep');   // RNCallKeep
export const getMessaging = () => mod('messaging'); // firebase messaging()
export const getInCallManager = () => mod('incall');
export const getExpoNotifications = () => mod('expoNotifications'); // permission prompt only

/** True when running in a build that has the native call stack. */
export function callsSupported(): boolean {
  return !!getWebRTC();
}
