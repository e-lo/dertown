import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME, getCategoryColor, getCategoryTextColor, getCategoryTextMuted } from '../../lib/theme';
import { fetchEventById, fetchRelatedEvents } from '../../lib/api';
import { formatTimeRange, formatDayHeader } from '../../lib/dateUtils';
import { Icon } from '../../components/Icon';
import { EventRow } from '../../components/EventRow';
import { useStars } from '../../contexts/StarContext';
import { APP_CONFIG } from '../../lib/app-config';
import type { MobileEvent, MobileRelatedEvents, MobileRelatedEventItem } from '../../lib/types';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<MobileEvent | null>(null);
  const [related, setRelated] = useState<MobileRelatedEvents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { starredIds, toggleStar } = useStars();
  const insets = useSafeAreaInsets();
  const isStarred = starredIds.has(id ?? '');

  useEffect(() => {
    if (!id) return;
    setEvent(null);
    setRelated(null);
    setLoading(true);
    setError(null);
    fetchEventById(id)
      .then((data) => {
        setEvent(data);
        setLoading(false);
        // Fetch related events in the background after main event loads
        fetchRelatedEvents(id).then(setRelated).catch(() => { /* non-fatal */ });
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load event');
        setLoading(false);
      });
  }, [id]);

  const category = event?.primary_tag?.name ?? null;
  const bgColor  = getCategoryColor(category);
  const fgColor  = getCategoryTextColor(category);
  const fgMuted  = getCategoryTextMuted(category);
  const isLightBg = category ? ['Arts+Culture','Sports','Featured'].includes(category) : false;
  const starColor = isLightBg
    ? (isStarred ? '#111111' : 'rgba(0,0,0,0.25)')
    : (isStarred ? THEME.starFilled : THEME.starUnstarred);

  const { dayOfWeek, dayNum, month } =
    event ? formatDayHeader(event.start_date) : { dayOfWeek: '', dayNum: '', month: '' };

  const timeStr = event
    ? formatTimeRange(event.start_time, event.end_time)
    : '';

  // Cast a related event item to the shape EventRow expects
  function asEvent(item: MobileRelatedEventItem): MobileEvent {
    return item as unknown as MobileEvent;
  }

  const hasSeries    = (related?.series?.events?.length ?? 0) > 0;
  const hasRelated   = (related?.related?.length ?? 0) > 0;
  const isSeriesParent = related?.series?.is_parent ?? false;

  return (
    <>
      {/* Hide the system nav bar — swipe-back gesture handles navigation */}
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

      {!loading && !error && event && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Hero card — extends under status bar */}
          <View style={[styles.hero, { backgroundColor: bgColor, paddingTop: insets.top + 8 }]}>
            {/* Back button */}
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon name="chevron-left" size={26} color={fgColor} />
            </TouchableOpacity>

            <Text style={[styles.heroTitle, { color: fgColor }]}>{event.title}</Text>
            <Text style={[styles.heroDate, { color: fgMuted }]}>
              {dayOfWeek}, {month} {dayNum}
            </Text>
            {timeStr ? <Text style={[styles.heroTime, { color: fgMuted }]}>{timeStr}</Text> : null}

            {/* Pills row + share/star pinned to the right */}
            <View style={styles.heroBottom}>
              <View style={styles.pills}>
                {event.primary_tag ? (
                  <View style={styles.pill}>
                    <Text style={[styles.pillText, { color: fgColor }]}>{event.primary_tag.name}</Text>
                  </View>
                ) : null}
                {event.secondary_tag ? (
                  <View style={styles.pill}>
                    <Text style={[styles.pillText, { color: fgColor }]}>{event.secondary_tag.name}</Text>
                  </View>
                ) : null}
                {event.registration ? (
                  <View style={[styles.pill, styles.regPill]}>
                    <Text style={[styles.pillText, { color: '#ffffff' }]}>Register</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.heroActions}>
                <TouchableOpacity
                  onPress={() => {
                    Share.share({
                      title: event.title,
                      message: `${event.title} — ${APP_CONFIG.webBaseUrl}/events/${event.id}`,
                      url: `${APP_CONFIG.webBaseUrl}/events/${event.id}`,
                    });
                  }}
                  style={styles.heroActionBtn}
                >
                  <Icon name="share" size={20} color={fgColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => toggleStar(id ?? '')}
                  style={styles.heroActionBtn}
                >
                  <Icon name="star" size={22} color={starColor} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Details section */}
          <View style={styles.details}>
            {event.location ? (
              <View style={styles.detailRow}>
                <Icon name="map" size={18} color={THEME.canary} />
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>{event.location.name}</Text>
                  {event.location.address ? (
                    <Text style={styles.detailSub}>{event.location.address}</Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {event.organization ? (
              <View style={styles.detailRow}>
                <Icon name="home" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>
                  {event.organization.name}
                </Text>
              </View>
            ) : null}

            {event.cost ? (
              <View style={styles.detailRow}>
                <Icon name="check" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>{event.cost}</Text>
              </View>
            ) : null}

            {event.description ? (
              <View style={styles.descriptionBlock}>
                <Text style={styles.description}>{event.description}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {event.website ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => Linking.openURL(event.website!)}
                >
                  <Text style={styles.actionBtnText}>Visit Website</Text>
                </TouchableOpacity>
              ) : null}

              {event.registration && event.website ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.registerBtn]}
                  onPress={() => Linking.openURL(event.website!)}
                >
                  <Text style={[styles.actionBtnText, styles.registerBtnText]}>
                    Register
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* ── Related Events ─────────────────────────────────────── */}
          {(hasSeries || hasRelated) && (
            <View style={styles.relatedSection}>

              {hasSeries && related?.series && (
                <>
                  {/* Series header — tapping navigates to the parent event */}
                  {isSeriesParent ? (
                    <Text style={styles.relatedSectionTitle}>Upcoming in this series</Text>
                  ) : (
                    <TouchableOpacity
                      style={styles.seriesHeader}
                      onPress={() => router.push(`/event/${related.series!.parent_id}` as never)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.seriesHeaderText} numberOfLines={1}>
                        Part of: {related.series.parent_title}
                      </Text>
                      <Icon name="chevron-right" size={16} color={THEME.canary} />
                    </TouchableOpacity>
                  )}
                  {related.series.events.map((item) => (
                    <EventRow
                      key={item.id}
                      event={asEvent(item)}
                      isStarred={starredIds.has(item.id)}
                      onPress={() => router.push(`/event/${item.id}` as never)}
                      onStar={() => toggleStar(item.id)}
                    />
                  ))}
                </>
              )}

              {hasRelated && (
                <>
                  <Text style={[styles.relatedSectionTitle, hasSeries && styles.relatedSectionTitleSpaced]}>
                    {event.organization
                      ? `More from ${event.organization.name}`
                      : 'More events nearby'}
                  </Text>
                  {related!.related.map((item) => (
                    <EventRow
                      key={item.id}
                      event={asEvent(item)}
                      isStarred={starredIds.has(item.id)}
                      onPress={() => router.push(`/event/${item.id}` as never)}
                      onStar={() => toggleStar(item.id)}
                    />
                  ))}
                </>
              )}
            </View>
          )}
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
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginLeft: -6,
    marginBottom: 10,
    padding: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 28,
  },
  heroDate: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  heroTime: {
    fontSize: 14,
    marginBottom: 4,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  regPill: {
    backgroundColor: THEME.successGreen,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 8,
  },
  heroActionBtn: {
    padding: 8,
  },
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
  actions: {
    gap: 10,
    paddingTop: 20,
    paddingBottom: 4,
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  registerBtn: {
    backgroundColor: THEME.successGreen,
    borderColor: THEME.successGreen,
  },
  registerBtnText: {
    color: '#ffffff',
  },

  // ── Related events ─────────────────────────────────────────────────────────
  relatedSection: {
    marginTop: 24,
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  seriesHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.canary,
    letterSpacing: 0.3,
  },
  relatedSectionTitle: {
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
  relatedSectionTitleSpaced: {
    marginTop: 16,
  },
});
