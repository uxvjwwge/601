import React from 'react';
import { Text, View } from 'react-native';

export default function Row({ label, right, help, children }) {
  return (
    <View style={{ marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: '#C8D3F5', fontSize: 15, fontWeight: '600' }}>{label}</Text>
        {right ?? children}
      </View>
      {help ? <Text style={{ color: '#8EA4E3', marginTop: 4, fontSize: 12 }}>{help}</Text> : null}
    </View>
  );
}
