import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import {
  getScopeMode,
  setScopeMode,
  SCOPE_MODES,
  SCOPE_MODE_LABELS,
  SCOPE_MODE_SHORT,
  type NotifScope,
  type ScopeNotifMode,
} from '../../lib/notificationScopes';

//
// ScopeNotifPicker — the per-server / per-group notification override control.
//
// Four-way segmented: Global (inherit Signal Control), All, @Only, Muted.
// Shared by the server settings sheet and the group settings sheet so the two
// can't drift apart.
//
export function ScopeNotifPicker({
  scope,
  id,
  userId,
  visible = true,
}: {
  scope: NotifScope;
  id?: string | null;
  userId?: string | null;
  /** Re-reads when this flips true, so a change made on web shows up. */
  visible?: boolean;
}) {
  const [mode, setMode] = useState<ScopeNotifMode>('default');

  useEffect(() => {
    if (!visible || !id) return;
    let cancelled = false;
    getScopeMode(scope, id).then((m) => { if (!cancelled) setMode(m); });
    return () => { cancelled = true; };
  }, [visible, scope, id]);

  const choose = async (next: ScopeNotifMode) => {
    if (!id) return;
    setMode(next); // optimistic — the write is a profile PATCH
    try {
      await setScopeMode(scope, userId, id, next);
    } catch (err: any) {
      setMode(await getScopeMode(scope, id));
      Alert.alert('Could not save', err?.message || 'Try again.');
    }
  };

  const noun = scope === 'server' ? 'server' : 'group';

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 6 }}>
        NOTIFICATIONS
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {SCOPE_MODES.map((m) => {
          const active = mode === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => choose(m)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: active ? 'rgba(239,68,68,0.18)' : '#18181b',
                borderWidth: 1,
                borderColor: active ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.07)',
              }}
            >
              <Text style={{ color: active ? '#fca5a5' : '#a1a1aa', fontSize: 11, fontWeight: '800' }}>
                {SCOPE_MODE_SHORT[m]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ color: '#52525b', fontSize: 10, marginTop: 6 }}>
        {SCOPE_MODE_LABELS[mode]}
        {mode === 'default' ? ' — follows Signal Control' : ` — just this ${noun}`}
      </Text>
    </View>
  );
}
