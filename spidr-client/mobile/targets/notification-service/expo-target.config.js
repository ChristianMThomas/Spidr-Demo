/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'notification-service',
  // .NotificationService → com.infinitetechteam.spidr.NotificationService
  bundleIdentifier: '.NotificationService',
  // Same floor as the main app (app.json has no explicit deploymentTarget,
  // Expo's SDK 54 default is 15.1) — keep both targets on one OS floor.
  // 15.1 also clears the iOS 15 floor for communication notifications.
  deploymentTarget: '15.1',
  // Intents is what INSendMessageIntent / INPerson come from; without it the
  // extension links but won't compile.
  frameworks: ['UserNotifications', 'Intents'],
  entitlements: {
    // Lets this extension return content updated from an INSendMessageIntent,
    // which is what swaps the banner's leading icon from the Spidr app icon
    // to the sender's avatar. Must ALSO be on the main app (see app.json) —
    // and enabled on the App ID in the Apple Developer portal, otherwise
    // provisioning fails at build time.
    'com.apple.developer.usernotifications.communication': true,
  },
});
