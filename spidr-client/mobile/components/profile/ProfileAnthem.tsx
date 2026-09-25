import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking } from 'react-native';
import { Music, X } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { entities } from '../../lib/apiClient';
import { emitter } from '../../lib/eventEmitter';
import { AudioPlayer } from '../chat/AudioPlayer';
import MusicSearchModal from '../call/MusicSearchModal';

export default function ProfileAnthem({ profile, editable, row }: { profile: any; editable: boolean; row: any }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const data = editable ? { ...profile, ...row } : profile;
  const name = data?.anthem_name || data?.profile_anthem?.title;
  const preview = data?.anthem_preview_url || data?.anthem_url || data?.profile_anthem?.preview_url;
  const save = async (track: any) => {
    if (busy || !row?.id) return;
    setBusy(true);
    const provider = track?.source === 'apple' ? 'apple' : 'spotify';
    const patch = {
      anthem_provider: track ? provider : '', anthem_track_id: track?.id || '',
      anthem_spotify_id: track && provider === 'spotify' ? track.id : '', anthem_isrc: track?.isrc || '',
      anthem_name: track?.name || '', anthem_artist: track?.artist || '', anthem_album_art_url: track?.album_art_url || '',
      anthem_preview_url: track?.preview_url || '', anthem_external_url: track?.external_url || '',
      anthem_duration_ms: track?.duration_ms || 0, anthem_url: '',
    };
    try {
      await entities.UserProfile.update(row.id, patch);
      emitter.emit('spidr-profile-updated', { profile: patch });
      await queryClient.invalidateQueries({ queryKey: ['profile-row'] });
      await queryClient.invalidateQueries({ queryKey: ['profile-of'] });
      setOpen(false);
    } catch (error: any) { Alert.alert('Profile anthem', error?.message || 'Could not save anthem.'); }
    finally { setBusy(false); }
  };
  if (!editable && !name) return null;
  return <View style={{ gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#27272a', marginBottom: 12 }}>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <Music size={20} color="#fda4af" />
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: '#fda4af', fontSize: 11 }}>PROFILE ANTHEM</Text><Text style={{ color: 'white', marginTop: 4 }}>{name || 'No anthem selected'}</Text>{!!name && <Text style={{ color: '#a1a1aa' }}>{data.anthem_artist || data.profile_anthem?.artist}</Text>}</View>
      {editable && <TouchableOpacity disabled={busy || !row?.id} accessibilityLabel="Change anthem" onPress={() => setOpen(true)} style={{ padding: 12 }}><Music color="white" size={20} /></TouchableOpacity>}
      {editable && !!name && <TouchableOpacity disabled={busy} accessibilityLabel="Remove anthem" onPress={() => save(null)} style={{ padding: 12 }}><X color="white" size={20} /></TouchableOpacity>}
    </View>
    {!!preview && <AudioPlayer key={preview} url={preview} accent="#fb7185" />}
    {!preview && /^https:\/\/(music\.apple\.com|open\.spotify\.com)\//.test(data?.anthem_external_url || '') && <TouchableOpacity onPress={() => Linking.openURL(data.anthem_external_url).catch(() => Alert.alert('Could not open music app'))}><Text style={{ color: '#fda4af', paddingVertical: 8 }}>Open in {data.anthem_provider === 'apple' ? 'Apple Music' : 'Spotify'}</Text></TouchableOpacity>}
    <MusicSearchModal open={open} onClose={() => setOpen(false)} onSelect={save} busy={busy} />
  </View>;
}
