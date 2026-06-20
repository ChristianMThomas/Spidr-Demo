import { Stack } from 'expo-router';

export default function DMLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#111111' } }} />;
}
