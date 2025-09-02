import React from 'react';
import { TextInput } from 'react-native';

export default function NumInput({ value, onChange, placeholder = '' }) {
  return (
    <TextInput
      keyboardType="numeric"
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#68759A"
      style={{
        backgroundColor: '#0E1730',
        color: 'white',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        minWidth: 110,
        borderWidth: 1,
        borderColor: '#243056',
        textAlign: 'right',
      }}
    />
  );
}
