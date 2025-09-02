import { Text, View } from 'react-native';

export default function Pill({ children }) {
  return (
    <View style={{
      backgroundColor: '#0E1730',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#27345E'
    }}>
      <Text style={{ color: 'white', fontVariant: ['tabular-nums'] }}>{children}</Text>
    </View>
  );
}
