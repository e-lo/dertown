import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME, getCategoryColor, getCategoryTextColor, getCategoryTextMuted } from '../../lib/theme';
import { fetchEventById, fetchRelatedEvents } from '../../lib/api';
import { formatTimeRange, formatDayHeader } from '../../lib/dateUtils';
import { openMaps } from '../../lib/mapUtils';
import { Icon } from '../../components/Icon';
import { EventRow } from '../../components/EventRow';
import { useStars } from '../../contexts/StarContext';
import { APP_CONFIG } from '../../lib/app-config';
import { addEventsToCalendar } from '../../lib/icalUtils';
import Markdown from 'react-native-markdown-display';
import type { MobileEvent, MobileRelatedEvents, MobileRelatedEventItem } from '../../lib/types';

const SERIES_PREVIEW_LIMIT = 5;
const RELATED_PREVIEW_LIMIT = 3;

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<MobileEvent | null>(null);
  const [related, setRelated] = useState<MobileRelatedEvents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarEventId, setCalendarEventId] = useState<string | null>(null);
  const {
    starredIds, toggleStar,
    starredSeriesIds, toggleStarSeries,
  } = useStars();
  const insets = useSafeAreaInsets();
  const isStarred = starredIds.has(id ?? '');

  useEffect(() => {
    if (!id) return;
    setEvent(null);
    setRelated(null);
    setLoading(true);
    setError(null);
    setCalendarEventId(null);
    fetchEventById(id)
      .then((data) => {
        setEvent(data);
        setLoading(false);
        fetchRelatedEvents(id, { seriesLimit: SERIES_PREVIEW_LIMIT, relatedLimit: RELATED_PREVIEW_LIMIT }).then(setRelated).catch(() => { /* non-fatal */ });
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

  function asEvent(item: MobileRelatedEventItem): MobileEvent {
    return item as unknown as MobileEvent;
  }

  const hasSeries    = (related?.series?.events?.length ?? 0) > 0;
  const hasRelated   = (related?.related?.length ?? 0) > 0;
  const isSeriesParent = related?.series?.is_parent ?? false;
  // True for any child event, even when all sibling events have already passed
  // (in which case hasSeries is false but we still want to show the series callout).
  const isChildEvent = related?.series != null && !isSeriesParent;

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

      {!loading && !error && event && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Hero card */}
          <View style={[styles.hero, { backgroundColor: bgColor, paddingTop: insets.top + 8 }]}>
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
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => openMaps(event.location!)}
                activeOpacity={0.7}
              >
                <Icon name="map" size={18} color={THEME.canary} />
                <View style={styles.detailText}>
                  <Text style={styles.detailLabel}>{event.location.name}</Text>
                  {event.location.address ? (
                    <Text style={styles.detailSub}>{event.location.address}</Text>
                  ) : null}
                </View>
                <Icon name="chevron-right" size={16} color={THEME.textMuted} />
              </TouchableOpacity>
            ) : null}

            {event.organization && event.organization_id ? (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => router.push(`/organization/${event.organization_id}` as never)}
                activeOpacity={0.7}
              >
                <Icon name="home" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>
                  {event.organization.name}
                </Text>
                <Icon name="chevron-right" size={16} color={THEME.textMuted} />
              </TouchableOpacity>
            ) : null}

            {event.cost ? (
              <View style={styles.detailRow}>
                <Icon name="check" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>{event.cost}</Text>
              </View>
            ) : null}

            {event.description ? (
              <View style={styles.descriptionBlock}>
                <Markdown
                  style={markdownStyles}
                  onLinkPress={(url) => {
                    router.push({
                      pathname: '/webview',
                      params: { url, title: event.title },
                    } as never);
                    return false; // prevent default handling
                  }}
                >
                  {event.description}
                </Markdown>
              </View>
            ) : null}

            <View style={styles.actions}>
              {calendarEventId ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    const startUnixSec = Math.floor(
                      new Date(`${event.start_date}T${event.start_time ?? '00:00:00'}`).getTime() / 1000
                    );
                    // calshow: uses Apple's Core Data epoch (seconds since Jan 1 2001),
                    // not Unix epoch (seconds since Jan 1 1970). Subtract the 31-year offset.
                    const CF_EPOCH_OFFSET = 978307200;
                    const url = Platform.OS === 'ios'
                      ? `calshow:${startUnixSec - CF_EPOCH_OFFSET}`
                      : `content://com.android.calendar/events/${calendarEventId}`;
                    Linking.openURL(url).catch(console.error);
                  }}
                >
                  <View style={styles.actionBtnInner}>
                    <Icon name="calendar" size={16} color={THEME.canary} />
                    <Text style={[styles.actionBtnText, { color: THEME.canary }]}>
                      View in Calendar
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    addEventsToCalendar([event], event.title)
                      .then((eid) => { if (eid) setCalendarEventId(eid); })
                      .catch(console.error)
                  }
                >
                  <View style={styles.actionBtnInner}>
                    <Icon name="calendar" size={16} color={THEME.textPrimary} />
                    <Text style={styles.actionBtnText}>Add to Calendar</Text>
                  </View>
                </TouchableOpacity>
              )}

              {event.website ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/webview',
                      params: { url: event.website!, title: event.title },
                    } as never)
                  }
                >
                  <Text style={styles.actionBtnText}>Visit Website</Text>
                </TouchableOpacity>
              ) : null}

              {event.registration && event.website ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.registerBtn]}
                  onPress={() =>
                    router.push({
                      pathname: '/webview',
                      params: { url: event.website!, title: `Register — ${event.title}` },
                    } as never)
                  }
                >
                  <Text style={[styles.actionBtnText, styles.registerBtnText]}>
                    Register
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Related Events */}
          {(hasSeries || hasRelated || isChildEvent) && (
            <View style={styles.relatedSection}>

              {(hasSeries || isChildEvent) && related?.series && (
                <>
                  {isSeriesParent ? (
                    <View style={styles.seriesParentHeader}>
                      <Text style={[styles.relatedSectionTitle, styles.seriesParentTitle]}>
                        Upcoming in this series
                      </Text>
                      {/* Follow/unfollow the series */}
                      <TouchableOpacity
                        style={styles.seriesActionBtn}
                        onPress={() =>
                          toggleStarSeries({ id: id ?? '', name: event.title })
                        }
                      >
                        <Icon
                          name="star"
                          size={13}
                          color={
                            starredSeriesIds.has(id ?? '')
                              ? THEME.canary
                              : THEME.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.seriesActionBtnText,
                            starredSeriesIds.has(id ?? '') && styles.seriesActionBtnActive,
                          ]}
                        >
                          {starredSeriesIds.has(id ?? '') ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                      {/* Subscribe to calendar feed */}
                      <TouchableOpacity
                        style={styles.seriesActionBtn}
                        onPress={() =>
                          router.push({
                            pathname: '/calendar-subscribe',
                            params: {
                              calendarUrl: `${APP_CONFIG.webBaseUrl}/api/events/series/${id}/ical`,
                              calendarName: event.title,
                              calendarDesc: `Subscribe to get all events in the "${event.title}" series automatically synced to your calendar.`,
                            },
                          } as never)
                        }
                      >
                        <Icon name="calendar" size={13} color={THEME.textMuted} />
                        <Text style={styles.seriesActionBtnText}>Subscribe</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* Callout card: prominently shows series membership with follow + two calendar actions */
                    <View style={styles.seriesCallout}>
                      {/* Header row: "PART OF SERIES" label + follow button */}
                      <View style={styles.seriesCalloutHeader}>
                        <Text style={styles.seriesCalloutLabel}>PART OF SERIES</Text>
                        <TouchableOpacity
                          style={[
                            styles.seriesCalloutFollowBtn,
                            starredSeriesIds.has(related.series.parent_id) && styles.seriesCalloutFollowBtnActive,
                          ]}
                          onPress={() =>
                            toggleStarSeries({
                              id: related.series!.parent_id,
                              name: related.series!.parent_title,
                            })
                          }
                        >
                          <Icon
                            name="star"
                            size={12}
                            color={starredSeriesIds.has(related.series.parent_id) ? THEME.canary : THEME.textMuted}
                          />
                          <Text
                            style={[
                              styles.seriesCalloutFollowText,
                              starredSeriesIds.has(related.series.parent_id) && styles.seriesCalloutFollowTextActive,
                            ]}
                          >
                            {starredSeriesIds.has(related.series.parent_id) ? 'Following' : 'Follow'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Series name — taps through to the parent event page */}
                      <TouchableOpacity
                        onPress={() => router.push(`/event/${related.series!.parent_id}` as never)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.seriesCalloutTitle} numberOfLines={2}>
                          {related.series.parent_title}
                        </Text>
                      </TouchableOpacity>

                      {/* Subscribe action */}
                      <View style={styles.seriesCalloutActions}>
                        <TouchableOpacity
                          style={styles.seriesCalloutActionBtn}
                          onPress={() =>
                            router.push({
                              pathname: '/calendar-subscribe',
                              params: {
                                calendarUrl: `${APP_CONFIG.webBaseUrl}/api/events/series/${related.series!.parent_id}/ical`,
                                calendarName: related.series!.parent_title,
                                calendarDesc: `Subscribe to get all events in the "${related.series!.parent_title}" series automatically synced to your calendar.`,
                              },
                            } as never)
                          }
                        >
                          <Icon name="bell" size={15} color={THEME.textPrimary} />
                          <Text style={styles.seriesCalloutActionTitle}>Subscribe</Text>
                          <Text style={styles.seriesCalloutActionSub}>Auto-syncs new events</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Section title for upcoming series instances */}
                  {!isSeriesParent && related.series.events.length > 0 && (
                    <Text style={styles.seriesCalloutEventsTitle}>
                      UPCOMING IN THIS SERIES ({related.series.events.length})
                    </Text>
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

          {/* Report / suggest update */}
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() =>
              Linking.openURL(
                `mailto:dertownleavenworth@gmail.com?subject=${encodeURIComponent(`Event update: ${event?.title ?? ''}`)}`
              )
            }
            activeOpacity={0.7}
          >
            <Text style={styles.reportBtnText}>Something wrong? Suggest an update →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </>
  );
}

// Markdown renderer styles — matches the app's dark theme
const markdownStyles = {
  body: {
    color: THEME.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  strong: {
    color: THEME.textPrimary,
    fontWeight: '700' as const,
  },
  em: {
    color: THEME.textSecondary,
    fontStyle: 'italic' as const,
  },
  link: {
    color: THEME.canary,
    textDecorationLine: 'underline' as const,
  },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  heading1: { color: THEME.textPrimary, fontSize: 18, fontWeight: '700' as const, marginVertical: 6 },
  heading2: { color: THEME.textPrimary, fontSize: 16, fontWeight: '700' as const, marginVertical: 4 },
  heading3: { color: THEME.textPrimary, fontSize: 15, fontWeight: '600' as const, marginVertical: 4 },
  code_inline: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: THEME.textPrimary,
    fontSize: 13,
    borderRadius: 3,
    paddingHorizontal: 4,
  },
  fence: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 6,
    padding: 10,
  },
  blockquote: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: THEME.canary,
    paddingLeft: 10,
    marginVertical: 6,
  },
  hr: { backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 10 },
};

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
  reportBtn: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  reportBtnText: {
    fontSize: 13,
    color: THEME.textMuted,
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
  // ── Detail rows ─────────────────────────────────────────────────────────────
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
    justifyContent: 'center',
  },
  actionBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
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

  // ── Related events ──────────────────────────────────────────────────────────
  relatedSection: {
    marginTop: 24,
  },
  // ── Series callout card (child event only) ──────────────────────────────────
  seriesCallout: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  seriesCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  seriesCalloutLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  seriesCalloutFollowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  seriesCalloutFollowBtnActive: {
    backgroundColor: 'rgba(250,204,21,0.12)',
  },
  seriesCalloutFollowText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  seriesCalloutFollowTextActive: {
    color: THEME.canary,
  },
  seriesCalloutTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.canary,
    paddingHorizontal: 14,
    paddingBottom: 12,
    lineHeight: 22,
  },
  seriesCalloutActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  seriesCalloutActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  seriesCalloutActionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  seriesCalloutActionSub: {
    fontSize: 10,
    color: THEME.textMuted,
  },
  seriesCalloutEventsTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
  // Series parent header: title + subscribe button side by side
  seriesParentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingRight: 8,
    gap: 6,
  },
  seriesParentTitle: {
    borderTopWidth: 0, // border is on the parent View
    flex: 1,
  },
  seriesActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  seriesActionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textMuted,
  },
  seriesActionBtnActive: {
    color: THEME.canary,
  },
});
