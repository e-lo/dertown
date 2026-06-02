import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { THEME } from '../lib/theme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

function MountainLogo() {
  return (
    <Svg width={48} height={48} viewBox="0 0 100 100">
      <Path
        d="M10,60 L40,20 L60,40 L80,30 L90,40"
        fill="none"
        stroke={THEME.canary}
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d="M10,60 L40,20 L60,60"
        fill="none"
        stroke={THEME.canary}
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>·</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function Feature({ emoji, label, detail }: { emoji: string; label: string; detail: string }) {
  return (
    <View style={styles.feature}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <View style={styles.featureText}>
        <Text style={styles.featureLabel}>{label}</Text>
        <Text style={styles.featureDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export function WelcomeModal({ visible, onDismiss }: Props) {
  const router = useRouter();

  const handleLearnMore = () => {
    onDismiss();
    // Small delay so modal closes before navigation
    setTimeout(() => router.push('/help' as never), 150);
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo + name */}
          <View style={styles.hero}>
            <MountainLogo />
            <Text style={styles.appName}>DerTown</Text>
            <Text style={styles.tagline}>Leavenworth's community events guide</Text>
          </View>

          {/* What it is */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What is Dertown?</Text>
            <Text style={styles.body}>
              A community-powered calendar of events, announcements and helpful info for
              Leavenworth, WA — built by locals, for locals.
            </Text>
          </View>

          {/* What it's not */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What Dertown is not</Text>
            <Bullet text="Social network" />
            <Bullet text="Business directory" />
            <Bullet text="Officially affiliated with the City of Leavenworth or the Chamber of Commerce" />
          </View>

          {/* Feature tour */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What you can do</Text>
            <Feature emoji="🗓" label="Browse events" detail="By day, category, or keyword search" />
            <Feature emoji="📍" label="Explore the map" detail="See what's happening where around town" />
            <Feature emoji="⭐" label="Save favorites" detail="Star events and series to keep track of them" />
            <Feature emoji="📅" label="Subscribe to a calendar" detail="Get all Dertown events (or just one series) in your phone's Calendar app" />
            <Feature emoji="🔔" label="Get announcements" detail="Opt in to push notifications for community news" />
            <Feature emoji="📤" label="Share events" detail="Send an event to a friend" />
          </View>

          {/* Help screen callout */}
          <View style={styles.helpCallout}>
            <Text style={styles.helpCalloutText}>
              Questions? Tap <Text style={styles.em}>ⓘ</Text> anytime to open the Help screen — FAQs, how to submit events, report issues, and send feedback.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.ctaBtn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.ctaBtnText}>Got it, let's explore!</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.learnMoreBtn} onPress={handleLearnMore} activeOpacity={0.7}>
            <Text style={styles.learnMoreText}>Read the full Help & FAQ →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: THEME.feedBackground },
  scroll:        { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 8 },

  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  tagline: {
    fontSize: 15,
    color: THEME.textSecondary,
    textAlign: 'center',
  },

  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.canary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    color: THEME.textSecondary,
    lineHeight: 22,
  },
  em: {
    color: THEME.textPrimary,
    fontWeight: '600',
  },

  bullet: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  bulletDot:  { fontSize: 15, color: THEME.canary, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 15, color: THEME.textSecondary, lineHeight: 22 },

  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  featureEmoji:  { fontSize: 22, lineHeight: 28 },
  featureText:   { flex: 1 },
  featureLabel:  { fontSize: 15, fontWeight: '600', color: THEME.textPrimary, marginBottom: 2 },
  featureDetail: { fontSize: 13, color: THEME.textSecondary, lineHeight: 18 },

  helpCallout: {
    backgroundColor: THEME.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  helpCalloutText: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },

  footer: {
    padding: 20,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  ctaBtn: {
    backgroundColor: THEME.canary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  learnMoreBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  learnMoreText: {
    fontSize: 14,
    color: THEME.textMuted,
  },
});
