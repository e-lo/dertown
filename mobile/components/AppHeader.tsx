import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '../lib/theme';

interface AppHeaderProps {
  /** Icon buttons or other controls to show on the right side. */
  right?: React.ReactNode;
}

/** Mountain-range icon matching public/logo.svg */
function MountainLogo() {
  return (
    <Svg width={26} height={26} viewBox="0 0 100 100">
      {/* Mountain range outline */}
      <Path
        d="M10,60 L40,20 L60,40 L80,30 L90,40"
        fill="none"
        stroke={THEME.textPrimary}
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Wedge peak overlay */}
      <Path
        d="M10,60 L40,20 L60,60"
        fill="none"
        stroke={THEME.textPrimary}
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Top-of-screen header used across all tabs.
 * Shows the mountain logo + "DerTown" wordmark left-aligned;
 * optional right slot for icon buttons.
 */
export function AppHeader({ right }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.wordmarkRow}>
        <MountainLogo />
        <Text style={styles.wordmark}>DerTown</Text>
      </View>
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
  wordmarkRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: THEME.textPrimary,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
