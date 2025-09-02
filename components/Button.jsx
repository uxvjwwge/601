import { Pressable, Text } from 'react-native';

export default function Button({ title, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#2A3C72' : '#314785',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
      })}
    >
      <Text style={{ color: 'white', fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}
