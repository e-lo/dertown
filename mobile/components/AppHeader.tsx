import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { THEME, MAX_CONTENT_WIDTH } from '../lib/theme';

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
  const router = useRouter();
  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <View style={styles.wordmarkRow}>
          <MountainLogo />
          <Text style={styles.wordmark}>DerTown</Text>
        </View>
        <View style={styles.rightSlot}>
          {right}
          <TouchableOpacity
            onPress={() => router.push('/help' as never)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Help and FAQ"
          >
            <Text style={styles.infoIcon}>ⓘ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: THEME.headerBackground,
    alignItems: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
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
  infoIcon: {
    fontSize: 20,
    color: THEME.textMuted,
    paddingHorizontal: 4,
  },
});
