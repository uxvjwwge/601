import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function CalculatorSection({ title, children }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    backgroundColor: '#0B1220',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2A44',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
});
