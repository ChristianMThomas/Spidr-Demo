import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Music } from 'lucide-react-native';
import { appleMusic, spotify } from '../../lib/apiClient';

export default function MusicSearchModal({ open, onClose, onSelect, appleOnly = false, busy = false, contained = false }: {
  open: boolean; onClose: () => void; onSelect: (track: any) => void; appleOnly?: boolean; busy?: boolean; contained?: boolean;
}) {
  const [provider, setProvider] = useState<'spotify' | 'apple'>('spotify');
  const catalog = appleOnly ? 'apple' : provider;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setResults([]); setError('');
    if (!open) { setQuery(''); return; }
    if (query.trim().length < 2) { setLoading(false); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response: any = await (catalog === 'apple' ? appleMusic : spotify).search(query.trim());
        if (active) setResults((response?.tracks || []).map((track: any) => ({ ...track, source: catalog })));
      } catch { if (active) setError('Music search is unavailable. Please try again.'); }
      finally { if (active) setLoading(false); }
    }, 320);
    return () => { active = false; clearTimeout(timer); };
  }, [open, query, catalog]);
  const Container = contained ? View : SafeAreaView;
  const content = <Container style={{ flex: 1, backgroundColor: '#101012', padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Choose a song</Text>
        <TouchableOpacity accessibilityLabel="Close music search" onPress={onClose} style={{ padding: 12 }}><X color="white" size={22} /></TouchableOpacity>
      </View>
      {!appleOnly && <View style={{ flexDirection: 'row', gap: 8 }}>{(['spotify', 'apple'] as const).map(id =>
        <TouchableOpacity key={id} accessibilityRole="tab" accessibilityState={{ selected: catalog === id }} onPress={() => setProvider(id)} style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: catalog === id ? '#b91c32' : '#27272a' }}>
          <Text style={{ color: 'white', textAlign: 'center' }}>{id === 'apple' ? 'Apple Music' : 'Spotify'}</Text>
        </TouchableOpacity>)}</View>}
      <TextInput accessibilityLabel="Search songs" value={query} onChangeText={setQuery} placeholder={`Search ${catalog === 'apple' ? 'Apple Music' : 'Spotify'}`} placeholderTextColor="#a1a1aa" style={{ backgroundColor: '#27272a', color: 'white', borderRadius: 8, padding: 14 }} />
      {loading || busy ? <ActivityIndicator color="#fb7185" /> : null}
      {!!error && <Text accessibilityRole="alert" style={{ color: '#fda4af' }}>{error}</Text>}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
        {!loading && query.length > 1 && !results.length && !error && <Text style={{ color: '#a1a1aa' }}>No songs found.</Text>}
        {results.map(track => <TouchableOpacity key={`${catalog}:${track.id}`} disabled={busy} onPress={() => onSelect(track)} accessibilityLabel={`Select ${track.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderBottomWidth: 1, borderColor: '#27272a' }}>
          {track.album_art_url ? <Image source={{ uri: track.album_art_url }} style={{ width: 48, height: 48, borderRadius: 6 }} /> : <Music color="#a1a1aa" size={32} />}
          <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={2} style={{ color: 'white', fontWeight: '600' }}>{track.name}</Text><Text numberOfLines={1} style={{ color: '#a1a1aa', marginTop: 4 }}>{track.artist}</Text></View>
        </TouchableOpacity>)}
      </ScrollView>
    </Container>;
  if (contained) return open ? <View style={{ height: 380 }}>{content}</View> : null;
  return <Modal visible={open} animationType="slide" onRequestClose={onClose}>{content}</Modal>;
}
