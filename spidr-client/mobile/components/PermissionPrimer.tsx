import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Mic, Camera, Bell, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../lib/authContext';
import { useThemeColors } from '../lib/theme';
import { hasBeenPrimed, markPrimed, requestAllPermissions } from '../lib/permissions';

//
// PermissionPrimer — the one-time "grant everything" step after login.
//
// Shown once per account per device. Its job is to put an explanation in front
// of the OS prompts rather than letting them fire cold: the system only ever
// asks once, so a prompt the user doesn't understand is a permission gone for
// good (recoverable only through the Settings app).
//
// Dismissing costs nothing — every permission still has its old lazy path.
// Mic and camera prompt on first call, notifications on the Signal Control
// master switch.
//
export default function PermissionPrimer() {
  const { user, isAuthenticated } = useAuth();
  const colors = useThemeColors();

  const [visible, setVisible] = useState(false);
  const [working, setWorking] = useState(false);
  // Guards against the modal reappearing on a re-render before AsyncStorage
  // has caught up with the flag write.
  const shownForRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    if (!isAuthenticated || !userId) return;
    if (shownForRef.current === userId) return;

    let cancelled = false;
    (async () => {
      const primed = await hasBeenPrimed(userId);
      if (cancelled || primed) return;
      shownForRef.current = userId;
      setVisible(true);
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  const grant = async () => {
    setWorking(true);
    try {
      await requestAllPermissions(user?.id);
    } finally {
      setWorking(false);
      setVisible(false);
    }
  };

  const skip = async () => {
    // Marked either way — a primer that keeps reappearing after a decline is
    // just nagging, and Signal Control is still there when they want it.
    await markPrimed(user?.id);
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={skip}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View
          style={{
            width: '100%', maxWidth: 400, borderRadius: 20, padding: 22,
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
          }}
        >
          <View style={{ alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <View
              style={{
                width: 52, height: 52, borderRadius: 15,
                backgroundColor: colors.accent + '22',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ShieldCheck size={26} color={colors.accent} />
            </View>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 1 }}>
              SET UP SPIDR
            </Text>
            <Text style={{ color: '#a1a1aa', fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
              Three quick permissions so calls and signals just work. Your phone
              will ask about each one.
            </Text>
          </View>

          <View style={{ gap: 14, marginBottom: 22 }}>
            <PermissionLine
              Icon={Mic} color="#22c55e"
              label="Microphone"
              hint="Talk in voice channels and calls"
            />
            <PermissionLine
              Icon={Camera} color="#60a5fa"
              label="Camera"
              hint="Video calls and camera uploads"
            />
            <PermissionLine
              Icon={Bell} color="#eab308"
              label="Notifications"
              hint="DMs, mentions and incoming calls"
            />
          </View>

          <TouchableOpacity
            onPress={grant}
            disabled={working}
            style={{
              backgroundColor: colors.accent, borderRadius: 13,
              paddingVertical: 14, alignItems: 'center', opacity: working ? 0.6 : 1,
            }}
          >
            {working
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 }}>Allow All</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={skip} disabled={working} style={{ paddingVertical: 13, alignItems: 'center' }}>
            <Text style={{ color: '#71717a', fontSize: 13, fontWeight: '600' }}>Not now</Text>
          </TouchableOpacity>

          <Text style={{ color: '#3f3f46', fontSize: 10, textAlign: 'center', lineHeight: 15 }}>
            You can change any of these later in Settings.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function PermissionLine({
  Icon, color, label, hint,
}: { Icon: any; color: string; label: string; hint: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={16} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: '#71717a', fontSize: 11, marginTop: 1 }}>{hint}</Text>
      </View>
    </View>
  );
}
