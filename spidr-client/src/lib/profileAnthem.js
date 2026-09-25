// Keep legacy Spotify IDs readable while storing new selections by provider.
export function anthemPatch(track) {
  const provider = track.source === 'apple' ? 'apple' : 'spotify';
  return {
    anthem_provider: provider,
    anthem_track_id: String(track.id),
    anthem_spotify_id: provider === 'spotify' ? String(track.id) : '',
    anthem_isrc: track.isrc || '',
    anthem_name: track.name || '',
    anthem_artist: track.artist || '',
    anthem_album_art_url: track.album_art_url || '',
    anthem_preview_url: track.preview_url || '',
    anthem_external_url: track.external_url || (provider === 'spotify'
      ? `https://open.spotify.com/track/${track.id}` : `https://music.apple.com/song/${track.id}`),
    anthem_duration_ms: track.duration_ms || 0,
    anthem_url: '',
  };
}

export function readAnthem(profile) {
  const provider = profile?.anthem_provider || 'spotify';
  const id = profile?.anthem_track_id || profile?.anthem_spotify_id || '';
  return { provider, id, label: provider === 'apple' ? 'Apple Music' : 'Spotify',
    externalUrl: profile?.anthem_external_url || (id ? (provider === 'apple'
      ? `https://music.apple.com/song/${id}` : `https://open.spotify.com/track/${id}`) : '') };
}
