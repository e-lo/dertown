import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  Share,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../lib/theme';
import { Icon } from '../components/Icon';
import { APP_CONFIG } from '../lib/app-config';

const ICAL_HTTPS_URL = `${APP_CONFIG.webBaseUrl}/api/calendar/ical`;
const WEBCAL_URL     = ICAL_HTTPS_URL.replace(/^https?:\/\//, 'webcal://');
const GOOGLE_CAL_URL = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(ICAL_HTTPS_URL)}`;

export default function CalendarSubscribeScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  const handleSubscribe = () => {
    if (Platform.OS === 'android') {
      Linking.openURL(GOOGLE_CAL_URL).catch(console.error);
    } else {
      // iOS: webcal:// triggers the native "Subscribe to Calendar?" sheet
      Linking.openURL(WEBCAL_URL).catch(console.error);
    }
  };

  const handleShareLink = () => {
    Share.share({
      title: 'Der Town Events Calendar',
      message: `Subscribe to Der Town events: ${ICAL_HTTPS_URL}`,
      url: ICAL_HTTPS_URL,
    });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />

      <ScrollView
        style={[styles.scroll, { backgroundColor: THEME.feedBackground }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="chevron-left" size={26} color={THEME.textPrimary} />
        </TouchableOpacity>

        {/* Icon + headline */}
        <View style={styles.heroRow}>
          <View style={styles.iconWrap}>
            <Icon name="calendar" size={32} color={THEME.canary} />
          </View>
          <Text style={styles.title}>Calendar Feed</Text>
        </View>

        <Text style={styles.subtitle}>
          Subscribe once and every Der Town event lands in your Calendar app
          automatically — including new events as they're published.
        </Text>

        {/* Primary CTA */}
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSubscribe} activeOpacity={0.8}>
          <Icon name="calendar" size={18} color="#111111" />
          <Text style={styles.primaryBtnText}>
            {Platform.OS === 'android' ? 'Subscribe in Google Calendar' : 'Open in Calendar App'}
          </Text>
        </TouchableOpacity>

        {/* Secondary: share / copy the raw https URL */}
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleShareLink} activeOpacity={0.75}>
          <Icon name="share" size={16} color={THEME.textPrimary} />
          <Text style={styles.secondaryBtnText}>Share Link</Text>
        </TouchableOpacity>

        {/* How it works */}
        <View style={styles.howCard}>
          <Text style={styles.howTitle}>How it works</Text>

          <View style={styles.howRow}>
            <Text style={styles.howNum}>1</Text>
            <Text style={styles.howText}>
              Tap <Text style={styles.howBold}>"Open in Calendar App"</Text> above.
            </Text>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>2</Text>
            <Text style={styles.howText}>
              Your Calendar app asks if you want to subscribe — tap{' '}
              <Text style={styles.howBold}>Subscribe</Text>.
            </Text>
          </View>
          <View style={styles.howRow}>
            <Text style={styles.howNum}>3</Text>
            <Text style={styles.howText}>
              That's it. New events appear in your calendar automatically.
            </Text>
          </View>
        </View>

        {/* Manual URL for power users */}
        <View style={styles.urlCard}>
          <Text style={styles.urlLabel}>Feed URL (for manual setup)</Text>
          <Text style={styles.urlText} selectable>{ICAL_HTTPS_URL}</Text>
          <Text style={styles.urlNote}>
            Works with Apple Calendar, Google Calendar, Outlook, and any app
            that supports calendar subscriptions.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginLeft: -6,
    marginBottom: 20,
    padding: 6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: THEME.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: THEME.textPrimary,
    flex: 1,
  },
  subtitle: {
    fontSize: 15,
    color: THEME.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.canary,
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 32,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  howCard: {
    backgroundColor: THEME.cardBackground,
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    gap: 12,
  },
  howTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  howRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  howNum: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.canary,
    width: 18,
    marginTop: 1,
  },
  howText: {
    flex: 1,
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
  howBold: {
    color: THEME.textPrimary,
    fontWeight: '600',
  },
  urlCard: {
    backgroundColor: THEME.cardBackground,
    borderRadius: 12,
    padding: 18,
    gap: 6,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  urlText: {
    fontSize: 12,
    color: THEME.canary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  urlNote: {
    fontSize: 12,
    color: THEME.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
});
