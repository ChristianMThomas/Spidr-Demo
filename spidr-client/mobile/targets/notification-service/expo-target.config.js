/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'notification-service',
  // .NotificationService → com.infinitetechteam.spidr.NotificationService
  bundleIdentifier: '.NotificationService',
  // Same floor as the main app (app.json has no explicit deploymentTarget,
  // Expo's SDK 54 default is 15.1) — keep both targets on one OS floor.
  deploymentTarget: '15.1',
  frameworks: ['UserNotifications'],
});
