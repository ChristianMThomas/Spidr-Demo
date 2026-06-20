import { Stack } from 'expo-router';

export default function ServerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111111' } }}>
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/channel/[channelId]" />
    </Stack>
  );
}
