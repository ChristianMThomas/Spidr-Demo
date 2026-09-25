import React, { useState, useSyncExternalStore } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, Linking } from 'react-native';
import { Music, Play, Pause, SkipForward, Plus, Minus, X } from 'lucide-react-native';
import { djPlayback } from '../../lib/djPlayback';
import { spotify } from '../../lib/apiClient';
import MusicSearchModal from './MusicSearchModal';

export default function DJBooth({ channelId, userId }: { channelId: string; userId: string }) {
  const { session, status, paused, volume, error } = useSyncExternalStore(djPlayback.subscribe, djPlayback.getSnapshot);
  const [picker, setPicker] = useState<'start' | 'next' | 'queue' | null>(null);
  const [busy, setBusy] = useState(false);
  const host = session?.host_id === userId;
  const run = async (action: () => Promise<any>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); setPicker(null); await djPlayback.refresh(); }
    catch (err: any) { Alert.alert('DJ Booth', err?.message || 'Could not update the session.'); }
    finally { setBusy(false); }
  };
  const select = (track: any) => run(() => {
    const meta = { source: 'apple', track_name: track.name, track_artist: track.artist, album_art_url: track.album_art_url,
      preview_url: track.preview_url, external_url: track.external_url, duration_ms: track.duration_ms, isrc: track.isrc,
      audio_route: session?.audio_route || 'preview' };
    const method = picker === 'queue' ? 'enqueue' : picker === 'next' ? 'next' : 'start';
    return spotify.djSession[method](channelId, track.id, meta);
  });
  const button = (label: string, Icon: any, action: () => void, disabled = false) => <TouchableOpacity accessibilityLabel={label} disabled={disabled || busy} onPress={action} style={{ minHeight: 44, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: disabled || busy ? 0.4 : 1 }}><Icon size={20} color="#fda4af" /><Text style={{ color: '#e4e4e7', fontSize: 12 }}>{label}</Text></TouchableOpacity>;
  if (picker) return <MusicSearchModal open onClose={() => setPicker(null)} onSelect={select} appleOnly busy={busy} contained />;
  return <View style={{ paddingVertical: 16, borderBottomWidth: 1, borderColor: '#27272a', gap: 12 }}>
    <Text style={{ color: '#fda4af', fontWeight: '800' }}>DJ BOOTH</Text>
    {session ? <>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {session.album_art_url ? <Image source={{ uri: session.album_art_url }} style={{ width: 64, height: 64, borderRadius: 8 }} /> : <Music size={40} color="#fda4af" />}
        <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>{session.track_name || 'Live audio'}</Text><Text style={{ color: '#a1a1aa', marginTop: 4 }}>{session.track_artist || session.host_user_name}</Text></View>
      </View>
      <Text accessibilityLiveRegion="polite" style={{ color: '#a1a1aa' }}>{error || ({ preview: 'Playing preview', ended: 'Preview finished', unavailable: 'No preview available', live: 'Live shared audio', waiting: 'Waiting for shared audio', paused: 'Paused for you', deafened: 'Deafened', loading: 'Loading audio' } as Record<string, string>)[status] || status}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        {button(paused ? 'Resume' : 'Pause', paused ? Play : Pause, djPlayback.toggle)}
        {button('Quieter', Minus, () => djPlayback.setVolume(volume - 0.1))}
        <Text style={{ color: '#a1a1aa' }}>{Math.round(volume * 100)}%</Text>
        {button('Louder', Plus, () => djPlayback.setVolume(volume + 0.1))}
        {host && button('Change track', Music, () => setPicker('next'))}
        {host && button('Next', SkipForward, () => run(() => spotify.djSession.advance(channelId)), !session.queue?.length)}
        {button('Add to queue', Plus, () => setPicker('queue'))}
        {host && button('End session', X, () => run(() => spotify.djSession.end(channelId)))}
      </View>
      {session.queue?.map((track: any) => <View key={track.qid} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ flex: 1, color: '#d4d4d8' }}>{track.track_name}</Text>{(host || track.added_by === userId) && button('Remove', X, () => run(() => spotify.djSession.dequeue(channelId, track.qid)))}</View>)}
      {session.audio_route !== 'stream' && <Text style={{ color: '#a1a1aa', fontSize: 12 }}>Native playback uses the available preview.</Text>}
      {!!session.external_url && /^https:\/\/(music\.apple\.com|open\.spotify\.com)\//.test(session.external_url) && <TouchableOpacity onPress={() => Linking.openURL(session.external_url).catch(() => Alert.alert('Could not open music app'))}><Text style={{ color: '#fda4af', paddingVertical: 8 }}>Open in music app</Text></TouchableOpacity>}
    </> : button('Start DJ session', Music, () => setPicker('start'))}
  </View>;
}
