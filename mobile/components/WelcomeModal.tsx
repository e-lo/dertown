import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '../lib/theme';

const SUBMIT_URL  = 'https://dertown.org/submit';
const CONTACT_EMAIL = 'dertownleavenworth@gmail.com';

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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

export function WelcomeModal({ visible, onDismiss }: Props) {
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

          <Section title="What is Dertown?">
            <Text style={styles.body}>
              A community-powered calendar of events, news, and announcements for
              Leavenworth, WA — built by locals, for locals and visitors alike.
            </Text>
          </Section>

          <Section title="What Dertown is not">
            <Bullet text="A ticketing platform — we link to tickets, we don't sell them" />
            <Bullet text="A complete business or restaurant directory" />
            <Bullet text="Officially affiliated with the City of Leavenworth or the Chamber of Commerce" />
          </Section>

          <Section title="Submit an event">
            <Text style={styles.body}>
              Know about something happening in town that isn't listed?
            </Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(SUBMIT_URL)}
              activeOpacity={0.7}
            >
              <Text style={styles.linkBtnText}>Submit an event at dertown.org →</Text>
            </TouchableOpacity>
          </Section>

          <Section title="Something wrong?">
            <Text style={styles.body}>
              Event details change — times move, events get cancelled. Tap{' '}
              <Text style={styles.em}>Suggest Update</Text> at the bottom of any
              event and we'll look into it.
            </Text>
          </Section>

          <Section title="Feedback & bugs">
            <Text style={styles.body}>
              Have an idea for the app or spotted a bug? We'd love to hear it.
            </Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Dertown app feedback`)}
              activeOpacity={0.7}
            >
              <Text style={styles.linkBtnText}>Email us at {CONTACT_EMAIL} →</Text>
            </TouchableOpacity>
          </Section>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.ctaBtn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.ctaBtnText}>Got it, let's explore!</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: THEME.feedBackground },
  scroll:      { flex: 1 },
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
    marginBottom: 8,
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

  linkBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: THEME.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  linkBtnText: {
    fontSize: 14,
    color: THEME.canary,
    fontWeight: '600',
  },

  footer: {
    padding: 20,
    paddingTop: 12,
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
});
