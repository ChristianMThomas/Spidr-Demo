import { Tabs } from 'expo-router';
import { Home, Users, Server, Film, Settings as SettingsIcon } from 'lucide-react-native';
import { useThemeColors } from '../../lib/theme';

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 82,
          paddingTop: 10,
          paddingBottom: 16,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: '#71717a',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'HOME',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'FRIENDS',
          tabBarIcon: ({ color, size }) => <Users color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="servers"
        options={{
          title: 'SERVERS',
          tabBarIcon: ({ color, size }) => <Server color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'WEB',
          tabBarIcon: ({ color, size }) => <Film color={color} size={size - 2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'SETTINGS',
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size - 2} />,
        }}
      />
    </Tabs>
  );
}
