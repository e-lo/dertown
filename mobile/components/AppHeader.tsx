import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../lib/theme';
import { APP_CONFIG } from '../lib/app-config';

interface AppHeaderProps {
  /** Icon buttons or other controls to show on the right side. */
  right?: React.ReactNode;
}

/**
 * Top-of-screen header used across all tabs.
 * Shows the app wordmark left-aligned; optional right slot for icon buttons.
 */
export function AppHeader({ right }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={styles.wordmark}>{APP_CONFIG.townName.toLowerCase()}</Text>
      {right ? <View style={styles.rightSlot}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: THEME.tabBarBackground,
  },
  wordmark: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: THEME.textPrimary,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
