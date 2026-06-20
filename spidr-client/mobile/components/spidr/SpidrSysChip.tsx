import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/apiClient';

// Floating SPIDR_SYS chip — mirrors the bottom-right terminal on the web home.
// Tap to open a fullscreen-ish modal with the patch note body.
export default function SpidrSysChip() {
  const [open, setOpen] = React.useState(false);

  const { data } = useQuery({
    queryKey: ['system-news'],
    queryFn: () => api.get('/system/news').catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  const news: any[] = Array.isArray((data as any)?.news)
    ? (data as any).news
    : Array.isArray(data)
      ? (data as any)
      : [];
  const latest = news[0];
  if (!latest) return null;

  const headline = latest.title || latest.headline || latest.body || '';
  if (!headline) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: 14,
          right: 14,
          backgroundColor: 'rgba(0,0,0,0.9)',
          borderWidth: 1,
          borderColor: 'rgba(239,68,68,0.45)',
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          maxWidth: '85%',
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          elevation: 6,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#ef4444',
            marginRight: 8,
          }}
        />
        <Text style={{ color: '#ef4444', fontSize: 11, fontFamily: 'monospace', marginRight: 6 }}>
          {'>'} SPIDR_SYS
        </Text>
        <Text
          style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: 'monospace', flexShrink: 1 }}
          numberOfLines={1}
        >
          {headline}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.7)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          {/* Backdrop sits behind the card as a sibling — taps on the card
              never bubble into it, so the ScrollView's pan gesture is
              uncontested. */}
          <Pressable
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              backgroundColor: '#0a0a0a',
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.4)',
              borderRadius: 18,
              maxHeight: '80%',
              overflow: 'hidden',
              shadowColor: '#ef4444',
              shadowOpacity: 0.35,
              shadowRadius: 18,
              elevation: 10,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 10,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(239,68,68,0.2)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#ef4444',
                    marginRight: 8,
                  }}
                />
                <Text
                  style={{
                    color: '#ef4444',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    letterSpacing: 2,
                  }}
                >
                  SPIDR_SYS
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={{ color: '#a1a1aa', fontSize: 18, paddingHorizontal: 6 }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {news.map((item: any, i: number) => {
                const title = item.title || item.headline || '';
                const body = item.description || item.body || '';
                const type = (item.type || 'UPDATE').toString().toUpperCase();
                const date = item.date || '';
                return (
                  <View key={item.id || i} style={{ marginBottom: i === 0 ? 18 : 22 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Text
                        style={{
                          color: type === 'ALERT' ? '#facc15' : type === 'FIX' ? '#22c55e' : '#ef4444',
                          fontSize: 9,
                          fontFamily: 'monospace',
                          letterSpacing: 1.5,
                          marginRight: 8,
                        }}
                      >
                        {type}
                      </Text>
                      {date ? (
                        <Text style={{ color: '#52525b', fontSize: 10, fontFamily: 'monospace' }}>
                          {date}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: '800',
                        marginBottom: 8,
                        lineHeight: 20,
                      }}
                    >
                      {title}
                    </Text>
                    {body ? (
                      <Text
                        style={{
                          color: '#d4d4d8',
                          fontSize: 13,
                          lineHeight: 20,
                        }}
                      >
                        {body}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
