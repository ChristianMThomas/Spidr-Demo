/**
 * Custom entry: register the FCM background handler BEFORE the React tree
 * loads, so an incoming-call push received while the app is backgrounded or
 * killed can ring the native call UI (CallKeep) headlessly.
 *
 * Everything is guarded — in Expo Go the firebase/callkeep modules don't
 * exist and this file degrades to a plain `expo-router/entry`.
 */
/* eslint-disable @typescript-eslint/no-var-requires */

try {
  // RNFB v22+ modular API: no callable default export. Use getMessaging()
  // to get an instance, then setBackgroundMessageHandler(instance, cb).
  const fbMsg = require('@react-native-firebase/messaging');
  if (typeof fbMsg?.getMessaging !== 'function') {
    throw new Error('firebase messaging: modular getMessaging() missing');
  }
  const messagingInstance = fbMsg.getMessaging();
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;

  fbMsg.setBackgroundMessageHandler(messagingInstance, async (msg) => {
    const data = msg?.data || {};
    if (data.type === 'incoming_call') {
      // Stash the ring so the JS side (callManager) can connect the call
      // once the user answers and the app wakes.
      await AsyncStorage.setItem('spidr_pending_call', JSON.stringify({ ...data, ts: Date.now() }));
      try {
        const RNCallKeep = require('react-native-callkeep').default;
        await RNCallKeep.setup({
          ios: { appName: 'Spidr' },
          android: {
            alertTitle: 'Phone account required',
            alertDescription: 'Spidr needs a phone account to ring you like a real call.',
            cancelButton: 'Cancel',
            okButton: 'Allow',
            additionalPermissions: [],
            foregroundService: {
              channelId: 'com.infinitetechteam.spidr.calls',
              channelName: 'Spidr Calls',
              notificationTitle: 'Spidr call in progress',
            },
          },
        });
        // Same deterministic UUID scheme as lib/callManager.ts.
        const hex = Array.from(String(data.conversationId || ''))
          .reduce((acc, ch) => acc + ch.charCodeAt(0).toString(16).padStart(2, '0'), '')
          .padEnd(32, '0')
          .slice(0, 32);
        const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
        RNCallKeep.displayIncomingCall(
          uuid,
          data.callerName || 'Spidr',
          data.callerName || 'Spidr',
          'generic',
          data.kind === 'video',
        );
      } catch { /* callkeep unavailable */ }
    } else if (data.type === 'call_ended') {
      await AsyncStorage.removeItem('spidr_pending_call');
      try {
        const RNCallKeep = require('react-native-callkeep').default;
        const hex = Array.from(String(data.conversationId || ''))
          .reduce((acc, ch) => acc + ch.charCodeAt(0).toString(16).padStart(2, '0'), '')
          .padEnd(32, '0')
          .slice(0, 32);
        const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
        RNCallKeep.reportEndCallWithUUID(uuid, 2 /* remote ended */);
      } catch { /* callkeep unavailable */ }
    }
  });
} catch (err) {
  // Expo Go OR modular-import mismatch. Log so the latter can't hide.
  console.warn('[index] background messaging setup skipped:', err?.message || err);
}

require('expo-router/entry');
