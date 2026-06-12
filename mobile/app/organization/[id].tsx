import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../lib/theme';
import { APP_CONFIG } from '../../lib/app-config';
import { fetchOrganization } from '../../lib/api';
import { openMaps } from '../../lib/mapUtils';
import { Icon } from '../../components/Icon';
import { EventRow } from '../../components/EventRow';
import { useStars } from '../../contexts/StarContext';
import { useBlocked } from '../../contexts/BlockContext';
import { ReportModal } from '../../components/ReportModal';
import type { MobileOrganization, MobileEvent } from '../../lib/types';

export default function OrganizationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    starredIds, toggleStar,
    starredOrgIds, toggleStarOrg,
  } = useStars();

  const [org, setOrg] = useState<MobileOrganization | null>(null);
  const [events, setEvents] = useState<MobileEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const { blockedOrgIds, blockOrg, unblockOrg } = useBlocked();

  const isBlocked = org ? blockedOrgIds.has(org.id) : false;

  const handleBlockToggle = () => {
    if (!org) return;
    if (isBlocked) {
      unblockOrg(org.id);
      return;
    }
    Alert.alert(
      `Block ${org.name}?`,
      'All events and content from this organizer will be hidden immediately, and we will be notified to review their content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            blockOrg({ id: org.id, name: org.name });
            router.back();
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!id) return;
    setOrg(null);
    setEvents([]);
    setLoading(true);
    setError(null);
    fetchOrganization(id)
      .then(({ organization, events: evts }) => {
        setOrg(organization);
        setEvents(evts);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load organization');
        setLoading(false);
      });
  }, [id]);

  const isStarred = org ? starredOrgIds.has(org.id) : false;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />

      {loading && (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.centeredBackBtn} onPress={() => router.back()}>
            <Icon name="chevron-left" size={26} color={THEME.textPrimary} />
          </TouchableOpacity>
          <ActivityIndicator color={THEME.canary} size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.centeredBackBtn} onPress={() => router.back()}>
            <Icon name="chevron-left" size={26} color={THEME.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && org && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Hero */}
          <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
            {/* Back button */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="chevron-left" size={26} color={THEME.textPrimary} />
            </TouchableOpacity>

            <View style={styles.heroContent}>
              <View style={styles.heroText}>
                <Text style={styles.heroLabel}>ORGANIZATION</Text>
                <Text style={styles.heroTitle}>{org.name}</Text>
              </View>
              {/* Star / follow button */}
              <TouchableOpacity
                style={styles.heroStarBtn}
                onPress={() => toggleStarOrg({ id: org.id, name: org.name })}
              >
                <Icon
                  name="star"
                  size={24}
                  color={isStarred ? THEME.canary : 'rgba(255,255,255,0.3)'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Details */}
          <View style={styles.details}>
            {org.location ? (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => openMaps(org.location!)}
                activeOpacity={0.7}
              >
                <Icon name="map" size={18} color={THEME.canary} />
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>{org.location.name}</Text>
                  {org.location.address ? (
                    <Text style={styles.detailSub}>{org.location.address}</Text>
                  ) : null}
                </View>
                <Icon name="chevron-right" size={16} color={THEME.textMuted} />
              </TouchableOpacity>
            ) : null}

            {org.website ? (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => WebBrowser.openBrowserAsync(org.website!)}
                activeOpacity={0.7}
              >
                <Icon name="external-link" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]} numberOfLines={1}>
                  {org.website.replace(/^https?:\/\//, '')}
                </Text>
                <Icon name="chevron-right" size={16} color={THEME.textMuted} />
              </TouchableOpacity>
            ) : null}

            {org.phone ? (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => Linking.openURL(`tel:${org.phone!.replace(/\D/g, '')}`)}
                activeOpacity={0.7}
              >
                <Icon name="phone" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>{org.phone}</Text>
                <Icon name="chevron-right" size={16} color={THEME.textMuted} />
              </TouchableOpacity>
            ) : null}

            {org.email ? (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => Linking.openURL(`mailto:${org.email}`)}
                activeOpacity={0.7}
              >
                <Icon name="mail" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]} numberOfLines={1}>
                  {org.email}
                </Text>
                <Icon name="chevron-right" size={16} color={THEME.textMuted} />
              </TouchableOpacity>
            ) : null}

            {org.description ? (
              <View style={styles.descriptionBlock}>
                <Text style={styles.description}>{org.description}</Text>
              </View>
            ) : null}
          </View>

          {/* Subscribe to org calendar feed */}
          <View style={styles.subscribeSection}>
            <TouchableOpacity
              style={styles.subscribeBtn}
              onPress={() =>
                router.push({
                  pathname: '/calendar-subscribe',
                  params: {
                    calendarUrl: `${APP_CONFIG.webBaseUrl}/api/organizations/${org.id}/ical`,
                    calendarName: `${org.name} Events`,
                    calendarDesc: `Subscribe to get upcoming events from ${org.name} automatically synced to your calendar.`,
                  },
                } as never)
              }
              activeOpacity={0.8}
            >
              <View style={styles.subscribeBtnInner}>
                <Icon name="calendar" size={16} color={THEME.canary} />
                <Text style={styles.subscribeBtnText}>Subscribe to Calendar</Text>
              </View>
              <Icon name="chevron-right" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Upcoming events */}
          <View style={styles.eventsSection}>
            <Text style={styles.eventsSectionTitle}>
              {events.length > 0
                ? `UPCOMING EVENTS (${events.length})`
                : 'UPCOMING EVENTS'}
            </Text>
            {events.length === 0 ? (
              <View style={styles.emptyEvents}>
                <Text style={styles.emptyEventsText}>No upcoming events</Text>
              </View>
            ) : (
              events.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  isStarred={starredIds.has(event.id)}
                  onPress={() => router.push(`/event/${event.id}` as never)}
                  onStar={() => toggleStar(event.id)}
                />
              ))
            )}
          </View>

          {/* Moderation: report or block this organizer (Guideline 1.2) */}
          <View style={styles.moderationSection}>
            <TouchableOpacity
              style={styles.moderationBtn}
              onPress={() => setReportVisible(true)}
              activeOpacity={0.7}
            >
              <Icon name="flag" size={13} color={THEME.textMuted} />
              <Text style={styles.moderationBtnText}>Report this organization</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moderationBtn}
              onPress={handleBlockToggle}
              activeOpacity={0.7}
            >
              <Icon name="block" size={13} color={isBlocked ? THEME.canary : THEME.textMuted} />
              <Text style={[styles.moderationBtnText, isBlocked && { color: THEME.canary }]}>
                {isBlocked ? 'Unblock this organizer' : 'Block this organizer'}
              </Text>
            </TouchableOpacity>
          </View>

          <ReportModal
            visible={reportVisible}
            onClose={() => setReportVisible(false)}
            contentType="organization"
            contentId={org.id}
            contentTitle={org.name}
            organization={{ id: org.id, name: org.name }}
          />
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredBackBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    padding: 8,
  },
  errorText: {
    color: THEME.errorRed,
    fontSize: 14,
  },
  scroll: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // ── Hero ─────────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: THEME.headerBackground,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginLeft: -6,
    marginBottom: 10,
    padding: 6,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroText: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.canary,
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.textPrimary,
    lineHeight: 30,
  },
  heroStarBtn: {
    padding: 8,
    marginTop: -2,
  },
  // ── Detail rows ─────────────────────────────────────────────────────────────
  details: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 15,
    color: THEME.textPrimary,
    fontWeight: '500',
  },
  detailSub: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  descriptionBlock: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  description: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 22,
  },
  // ── Subscribe section ───────────────────────────────────────────────────────
  subscribeSection: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.cardBackground,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  subscribeBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  // ── Events section ──────────────────────────────────────────────────────────
  eventsSection: {
    marginTop: 24,
  },
  eventsSectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  emptyEvents: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  emptyEventsText: {
    fontSize: 14,
    color: THEME.textMuted,
  },
  // ── Moderation ──────────────────────────────────────────────────────────────
  moderationSection: {
    marginTop: 20,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  moderationBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  moderationBtnText: {
    fontSize: 13,
    color: THEME.textMuted,
  },
});
