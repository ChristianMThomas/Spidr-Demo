import { View, Text } from 'react-native';

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12 bg-spidr-dark">
      <Text className="text-white text-lg font-semibold mb-2">{title}</Text>
      {hint && <Text className="text-gray-400 text-center">{hint}</Text>}
    </View>
  );
}
