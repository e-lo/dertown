import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../lib/theme';
import { Icon } from '../components/Icon';

const SUBMIT_EVENT_URL        = 'https://dertown.org/submit';
const SUBMIT_ANNOUNCEMENT_URL = 'https://dertown.org/submit-announcement';
const TERMS_URL               = 'https://dertown.org/terms';
const CONTACT_EMAIL           = 'dertownleavenworth@gmail.com';
const FEATURE_REQUEST_URL     = 'https://github.com/e-lo/dertown/issues/new?template=feature_request.yml';
const BUG_REPORT_URL          = 'https://github.com/e-lo/dertown/issues/new?template=bug_report.yml';

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

function ActionBtn({ label, url, subject }: { label: string; url?: string; subject?: string }) {
  const href = url ?? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject ?? '')}`;
  return (
    <TouchableOpacity
      style={styles.actionBtn}
      onPress={() => Linking.openURL(href)}
      activeOpacity={0.7}
    >
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="arrow-left" size={22} color={THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── About ───────────────────────────────────────────────────────── */}
        <Section title="What is Dertown?">
          <Text style={styles.body}>
            A community-powered calendar of events, announcements and helpful info for
            Leavenworth, WA — built by locals, for locals and visitors alike.
          </Text>
        </Section>

        <Section title="What Dertown is not">
          <Bullet text="A social network" />
          <Bullet text="A ticketing platform — we link to tickets, we don't sell them" />
          <Bullet text="A complete business or restaurant directory" />
          <Bullet text="Officially affiliated with the City of Leavenworth or the Chamber of Commerce" />
        </Section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <Section title="What can I do in the app?">
          <Bullet text="Browse upcoming events by day, category, or keyword search" />
          <Bullet text="Explore a live map of where events are happening around town" />
          <Bullet text="Star events and series to save your favorites" />
          <Bullet text="Subscribe to the Dertown calendar — all events appear automatically in your phone's Calendar app" />
          <Bullet text="Subscribe to a single event series to follow just that recurring event" />
          <Bullet text="Opt in to push notifications for community announcements" />
          <Bullet text="Share individual events with friends" />
        </Section>

        <Section title="What's on the website that's not in the app?">
          <Text style={styles.body}>
            Submitting events and announcements is done through{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('https://dertown.org')}>
              dertown.org
            </Text>
            {'. '}
            The website also has additional organization and venue pages.
          </Text>
        </Section>

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <Section title="How do I submit an event?">
          <Text style={styles.body}>
            Event submissions are reviewed and added to the calendar within a couple of days.
          </Text>
          <ActionBtn label="Submit an event at dertown.org →" url={SUBMIT_EVENT_URL} />
        </Section>

        <Section title="How do I submit an announcement?">
          <Text style={styles.body}>
            Announcements appear in the News tab and can trigger push notifications to subscribers.
          </Text>
          <ActionBtn label="Submit an announcement →" url={SUBMIT_ANNOUNCEMENT_URL} />
        </Section>

        {/* ── Report ──────────────────────────────────────────────────────── */}
        <Section title="Something's wrong with an event listing">
          <Text style={styles.body}>
            Times change, events get cancelled. Tap{' '}
            <Text style={styles.em}>Suggest Update</Text> at the bottom of any event
            detail screen and we'll look into it promptly.
          </Text>
          <ActionBtn
            label="Email us about an event →"
            subject="Event update suggestion"
          />
        </Section>

        {/* ── App feedback ────────────────────────────────────────────────── */}
        <Section title="I found a bug in the app">
          <Text style={styles.body}>
            Please report it so we can fix it! You can email us or file a GitHub issue (requires a free GitHub account).
          </Text>
          <ActionBtn label="Email us about a bug →" subject="Dertown app bug report" />
          <ActionBtn label="Report on GitHub →" url={BUG_REPORT_URL} />
        </Section>

        <Section title="I have an idea or feature request">
          <Text style={styles.body}>
            We'd love to hear it. Email us or file a GitHub feature request (requires a free GitHub account).
          </Text>
          <ActionBtn label="Email us your idea →" subject="Dertown app feature idea" />
          <ActionBtn label="Request on GitHub →" url={FEATURE_REQUEST_URL} />
        </Section>

        <Section title="General questions or feedback">
          <ActionBtn
            label={`Email ${CONTACT_EMAIL} →`}
            subject="Dertown feedback"
          />
        </Section>

        {/* ── Legal ───────────────────────────────────────────────────────── */}
        <Section title="Terms of Use">
          <ActionBtn label="Read Terms of Use at dertown.org →" url={TERMS_URL} />
        </Section>

        <Section title="Disclaimer">
          <Text style={styles.body}>
            The information provided in this app is for convenience only and should not be
            construed as official. While we strive to maintain accurate and up-to-date
            information, please verify details directly with the organizing entity.
            Corrections and updates are gladly accepted —{' '}
            <Text
              style={styles.link}
              onPress={() =>
                Linking.openURL(`mailto:${CONTACT_EMAIL}?subject=Dertown inaccuracy report`)
              }
            >
              let us know
            </Text>
            {' '}if you notice any inaccuracies.
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: THEME.feedBackground },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.tabBarBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
  },

  scroll:        { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 48 },

  section: { marginBottom: 28 },
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
  link: {
    color: THEME.canary,
  },

  bullet: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  bulletDot:  { fontSize: 15, color: THEME.canary, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 15, color: THEME.textSecondary, lineHeight: 22 },

  actionBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: THEME.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionBtnText: {
    fontSize: 14,
    color: THEME.canary,
    fontWeight: '600',
  },
});
