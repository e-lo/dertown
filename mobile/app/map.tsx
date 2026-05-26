import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../lib/theme';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Map coming in Plan 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.feedBackground, alignItems: 'center', justifyContent: 'center' },
  text: { color: THEME.textMuted, fontSize: 16 },
});
