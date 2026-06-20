import { ActivityIndicator, View } from 'react-native';

export function Spinner({ size = 'large', center = true }: { size?: 'small' | 'large'; center?: boolean }) {
  if (center) {
    return (
      <View className="flex-1 items-center justify-center bg-spidr-dark">
        <ActivityIndicator size={size} color="#dc2626" />
      </View>
    );
  }
  return <ActivityIndicator size={size} color="#dc2626" />;
}
