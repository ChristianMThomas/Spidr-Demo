/**
 * builtinWidgets — single source of truth for which module names render with
 * a hardcoded interactive widget instead of going through DynamicModuleWidget
 * (which renders user-defined payloads / AI-generated mock content).
 *
 * Background: officially-shipped "Spidr modules" (Symbiote Pet, Gaming Uplink,
 * Spotify Now Playing, etc.) need their real React components, not the generic
 * DynamicModuleWidget. Two different surfaces — the Module Nexus' Installed
 * tab and the profile Modules tab — both need to route to those components.
 * Previously each surface had its own BUILTIN_WIDGETS map, and the profile
 * tab was missing 'Spotify Now Playing', which is why it fell through to the
 * LLM-backed ApiSyncWidget and showed hallucinated content like Burna Boy's
 * "Last Last" with fake stream counts.
 *
 * The author_id === 'spidr-official' gate is a name-squatting defense: it
 * stops a user from publishing a module called "Symbiote Entity Pet" (or any
 * other builtin name) and having it hijack the real widget on someone else's
 * profile.
 */
import SymbiotePet        from './SymbiotePet';
import GamingUplink       from './GamingUplink';
import PCSpecsFlex        from './PCSpecsFlex';
import SpotifyNowPlaying  from './SpotifyNowPlaying';
import AppleMusicNowPlaying from './AppleMusicNowPlaying';
import SteamNowPlaying    from './SteamNowPlaying';

export const BUILTIN_WIDGETS = {
  'Symbiote Entity Pet':    SymbiotePet,
  'Gaming Uplink Card':     GamingUplink,
  'PC Specs Flex':          PCSpecsFlex,
  'Spotify Now Playing':    SpotifyNowPlaying,
  'Apple Music Now Playing': AppleMusicNowPlaying,
  'Steam Now Playing':      SteamNowPlaying,
};

const SPIDR_OFFICIAL = 'spidr-official';

/**
 * Resolve the React component for a module if (and only if) it's an official
 * builtin. Returns null when the module should fall through to
 * DynamicModuleWidget — either because the name isn't builtin, or because
 * the author_id is missing/wrong (name-squatting attempt).
 */
export function getBuiltinWidget(mod) {
  if (!mod) return null;
  const widget = BUILTIN_WIDGETS[mod.name];
  if (!widget) return null;
  if (mod.author_id !== SPIDR_OFFICIAL) return null;
  return widget;
}
