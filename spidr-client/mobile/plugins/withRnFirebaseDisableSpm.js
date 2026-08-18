const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Two Podfile tweaks needed to get @react-native-firebase v22+ to link on
// iOS under Expo's static-frameworks setup:
//   1. $RNFirebaseDisableSPM = true — opt out of Firebase's Swift Package
//      Manager integration (SPM + static linkage = duplicate symbols).
//   2. use_modular_headers! — GoogleUtilities is a Swift pod that doesn't
//      define its own module map, so static linkage can't import it into
//      Swift without modular headers enabled globally.
// EAS regenerates the Podfile every build, so patch via a dangerous mod.
module.exports = function withRnFirebaseDisableSpm(config) {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const podfile = path.join(mod.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');

      if (!contents.includes('$RNFirebaseDisableSPM')) {
        contents = `$RNFirebaseDisableSPM = true\n\n${contents}`;
      }
      if (!contents.includes('use_modular_headers!')) {
        // Insert right after the `platform :ios` line so it's global.
        contents = contents.replace(
          /(platform :ios[^\n]*\n)/,
          `$1use_modular_headers!\n`,
        );
      }

      fs.writeFileSync(podfile, contents);
      return mod;
    },
  ]);
};
