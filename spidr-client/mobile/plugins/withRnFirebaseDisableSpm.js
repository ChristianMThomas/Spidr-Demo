const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// react-native-firebase v22+ resolves Firebase via Swift Package Manager by
// default, which collides with Expo's `use_frameworks! :linkage => :static`
// (duplicate symbols at link time). Setting $RNFirebaseDisableSPM = true at
// the top of the Podfile falls back to the CocoaPods path, which is what
// works with static frameworks. Do this via a dangerous mod because EAS
// regenerates the Podfile on every build.
module.exports = function withRnFirebaseDisableSpm(config) {
  return withDangerousMod(config, [
    'ios',
    async (mod) => {
      const podfile = path.join(mod.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes('$RNFirebaseDisableSPM')) {
        contents = `$RNFirebaseDisableSPM = true\n\n${contents}`;
        fs.writeFileSync(podfile, contents);
      }
      return mod;
    },
  ]);
};
