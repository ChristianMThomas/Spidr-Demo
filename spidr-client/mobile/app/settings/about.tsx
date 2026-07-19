import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { ArrowLeft, Info, Terminal, Mail, FileText, ShieldCheck } from 'lucide-react-native';
import { system } from '../../lib/apiClient';
import { useThemeColors } from '../../lib/theme';

// ── About (mobile) ───────────────────────────────────────────────────────────
// Patch notes from GET /system/news (same feed the SPIDR_SYS terminal renders
// on web), app version from app.json via expo-constants, and credits.

interface NewsItem {
  id: string;
  title: string;
  date: string;
  type: 'UPDATE' | 'ALERT' | 'FIX';
  description: string;
}

const TYPE_COLORS: Record<string, string> = {
  UPDATE: '#FF3333',
  FIX: '#22c55e',
  ALERT: '#eab308',
};

export default function About() {
  const router = useRouter();
  const colors = useThemeColors();
  const version = Constants.expoConfig?.version ?? '1.9';

  const { data: news, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['system-news'],
    queryFn: () => system.news(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(161,161,170,0.1)', borderWidth: 1, borderColor: 'rgba(161,161,170,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={18} color="#a1a1aa" />
          </View>
          <View>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 }}>ABOUT SPIDR</Text>
            <Text style={{ color: '#71717a', fontSize: 11 }}>Patch notes, version, credits.</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {/* Version card */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' }}>
              <Terminal size={20} color="#FF3333" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>SPIDR MOBILE</Text>
              <Text style={{ color: '#71717a', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                v{version} · Expo · iOS + Android
              </Text>
            </View>
          </View>
          <Text style={{ color: '#52525b', fontSize: 11, lineHeight: 16, marginTop: 12 }}>
            The same Spidr as the web — servers, DMs, friends, and THE WEB clip feed — running against the
            same live backend. Built by Chris (full-stack, mobile, infrastructure) and FiFi (design, frontend).
          </Text>
        </View>

        {/* Support + legal */}
        <View style={card}>
          <Text style={{ color: '#71717a', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 10 }}>
            SUPPORT & LEGAL
          </Text>
          <LinkRow
            Icon={Mail}
            label="Contact support"
            value="christhomas0634@gmail.com"
            onPress={() => Linking.openURL('mailto:christhomas0634@gmail.com?subject=Spidr%20support')}
          />
          <LinkRow
            Icon={ShieldCheck}
            label="Privacy Policy"
            value="spidrapp.infinitetechteam.com/privacy"
            onPress={() => Linking.openURL('https://spidrapp.infinitetechteam.com/privacy')}
          />
          <LinkRow
            Icon={FileText}
            label="Terms of Service"
            value="spidrapp.infinitetechteam.com/terms"
            onPress={() => Linking.openURL('https://spidrapp.infinitetechteam.com/terms')}
            last
          />
        </View>

        {/* Patch notes */}
        <Text style={{ color: '#71717a', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginLeft: 4 }}>
          SPIDR_SYS // PATCH LOG
        </Text>

        {isLoading && <ActivityIndicator color="#FF3333" style={{ marginTop: 20 }} />}

        {!isLoading && (!news || news.length === 0) && (
          <View style={card}>
            <Text style={{ color: '#71717a', fontSize: 12 }}>
              Could not reach the patch log. Check your connection and try again.
            </Text>
          </View>
        )}

        {(news ?? []).map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const [expanded, setExpanded] = React.useState(false);
  const color = TYPE_COLORS[item.type] ?? '#a1a1aa';
  const long = item.description.length > 260;

  return (
    <TouchableOpacity
      activeOpacity={long ? 0.85 : 1}
      onPress={() => long && setExpanded((e) => !e)}
      style={card}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: color + '22', borderWidth: 1, borderColor: color + '55' }}>
          <Text style={{ color, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 }}>{item.type}</Text>
        </View>
        <Text style={{ color: '#52525b', fontSize: 10, fontFamily: 'monospace' }}>{item.date}</Text>
      </View>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>{item.title}</Text>
      <Text style={{ color: '#71717a', fontSize: 11, lineHeight: 17 }} numberOfLines={expanded ? undefined : 5}>
        {item.description}
      </Text>
      {long && (
        <Text style={{ color: '#FF3333', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 8 }}>
          {expanded ? 'SHOW LESS' : 'READ MORE'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function LinkRow({
  Icon, label, value, onPress, last,
}: { Icon: any; label: string; value: string; onPress: () => void; last?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <Icon size={16} color="#a1a1aa" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: '#71717a', fontSize: 10, fontFamily: 'monospace' }} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const card = {
  backgroundColor: '#111',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.05)' as const,
  borderRadius: 14,
  padding: 16,
};
