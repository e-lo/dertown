import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ListRenderItem,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { THEME, MAX_CONTENT_WIDTH } from '../../lib/theme';
import { APP_CONFIG } from '../../lib/app-config';
import { AppHeader } from '../../components/AppHeader';
import { Icon } from '../../components/Icon';
import { groupEventsByDate } from '../../lib/dateUtils';
import { LoadingView, ErrorView, EmptyView } from '../../components/ScreenStates';
import { useEventList } from '../../hooks/useEventList';
import { fetchFollowedEvents } from '../../lib/api';
import { EventRow } from '../../components/EventRow';
import { DayHeader } from '../../components/DayHeader';
import { useStars } from '../../contexts/StarContext';
import { openMaps } from '../../lib/mapUtils';
import type { MobileEvent } from '../../lib/types';
import type { StarredEntity } from '../../lib/stars';

type EventListItem =
  | { type: 'header'; date: string }
  | { type: 'event'; event: MobileEvent };

/** Compact banner that surfaces the calendar-feed subscribe option. */
function CalendarFeedBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.bannerIcon}>
        <Icon name="calendar" size={20} color={THEME.canary} />
      </View>
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>Subscribe to Calendar Feed</Text>
        <Text style={styles.bannerSub}>All events, auto-synced to your Calendar app</Text>
      </View>
      <Icon name="chevron-right" size={18} color={THEME.textMuted} />
    </TouchableOpacity>
  );
}

type FollowingItem =
  | { kind: 'org';      entity: StarredEntity }
  | { kind: 'series';   entity: StarredEntity }
  | { kind: 'location'; entity: StarredEntity };

function FollowingRow({
  item,
  onPress,
  onSubscribe,
  onUnfollow,
}: {
  item: FollowingItem;
  onPress: () => void;
  onSubscribe?: () => void;
  onUnfollow: () => void;
}) {
  const iconName: 'home' | 'calendar' | 'map' =
    item.kind === 'org' ? 'home' : item.kind === 'series' ? 'calendar' : 'map';

  const kindLabel =
    item.kind === 'org' ? 'Organization' : item.kind === 'series' ? 'Series' : 'Location';

  return (
    <View style={styles.followingRow}>
      <TouchableOpacity style={styles.followingMain} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.followingIconWrap}>
          <Icon name={iconName} size={18} color={THEME.canary} />
        </View>
        <View style={styles.followingText}>
          <Text style={styles.followingName} numberOfLines={1}>{item.entity.name}</Text>
          <Text style={styles.followingKind}>{kindLabel}</Text>
        </View>
        <Icon name="chevron-right" size={16} color={THEME.textMuted} />
      </TouchableOpacity>
      {/* Subscribe to calendar feed */}
      {onSubscribe ? (
        <TouchableOpacity style={styles.followingCalBtn} onPress={onSubscribe}>
          <Icon name="calendar" size={15} color={THEME.textMuted} />
        </TouchableOpacity>
      ) : null}
      {/* Tap star again to unfollow */}
      <TouchableOpacity style={styles.followingStarBtn} onPress={onUnfollow}>
        <Icon name="star" size={16} color={THEME.canary} />
      </TouchableOpacity>
    </View>
  );
}

export default function StarredScreen() {
  const {
    starredIds, toggleStar,
    starredOrgs, toggleStarOrg,
    starredSeries, toggleStarSeries,
    starredLocations, toggleStarLocation,
  } = useStars();
  const { events, loading, error } = useEventList();
  const router = useRouter();

  // ── Followed org/series events ─────────────────────────────────────────────
  const [followedEvents, setFollowedEvents] = useState<MobileEvent[]>([]);
  const [followedLoading, setFollowedLoading] = useState(false);

  const orgIds    = useMemo(() => starredOrgs.map((e) => e.id),    [starredOrgs]);
  const seriesIds = useMemo(() => starredSeries.map((e) => e.id),  [starredSeries]);

  const refreshFollowedEvents = useCallback(() => {
    if (orgIds.length === 0 && seriesIds.length === 0) {
      setFollowedEvents([]);
      return;
    }
    setFollowedLoading(true);
    fetchFollowedEvents(orgIds, seriesIds)
      .then(setFollowedEvents)
      .catch(() => setFollowedEvents([]))
      .finally(() => setFollowedLoading(false));
  }, [orgIds, seriesIds]);

  useEffect(() => {
    refreshFollowedEvents();
  }, [refreshFollowedEvents]);

  // ── Merge individually starred + followed entity events ────────────────────
  // Individually starred events come from the cached full event list.
  // Followed events come from the dedicated API call.
  // Deduplicate by ID (union), sort ascending by date.
  const allDisplayEvents = useMemo(() => {
    const individuallyStarred = events.filter((e) => starredIds.has(e.id));
    const starredSet = new Set(individuallyStarred.map((e) => e.id));
    const followedExtra = followedEvents.filter((e) => !starredSet.has(e.id));
    return [...individuallyStarred, ...followedExtra].sort((a, b) =>
      a.start_date.localeCompare(b.start_date)
    );
  }, [events, starredIds, followedEvents]);

  const listItems: EventListItem[] = useMemo(() => {
    const groups = groupEventsByDate(allDisplayEvents);
    const items: EventListItem[] = [];
    for (const group of groups) {
      items.push({ type: 'header', date: group.date });
      for (const event of group.events) {
        items.push({ type: 'event', event });
      }
    }
    return items;
  }, [allDisplayEvents]);

  const followingItems: FollowingItem[] = useMemo(() => {
    return [
      ...starredOrgs.map((e): FollowingItem      => ({ kind: 'org',      entity: e })),
      ...starredSeries.map((e): FollowingItem    => ({ kind: 'series',   entity: e })),
      ...starredLocations.map((e): FollowingItem => ({ kind: 'location', entity: e })),
    ];
  }, [starredOrgs, starredSeries, starredLocations]);

  const hasFollowing      = followingItems.length > 0;
  const hasDisplayEvents  = listItems.length > 0;
  const hasFollowedOrStar = orgIds.length > 0 || seriesIds.length > 0 || starredIds.size > 0;

  const renderEventItem: ListRenderItem<EventListItem> = ({ item }) => {
    if (item.type === 'header') return <DayHeader dateStr={item.date} />;
    return (
      <EventRow
        event={item.event}
        isStarred={starredIds.has(item.event.id)}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.event.id } })}
        onStar={() => toggleStar(item.event.id)}
      />
    );
  };

  const goToSubscribe = () => router.push('/calendar-subscribe' as never);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />

      {loading && <LoadingView />}

      {!loading && error && <ErrorView message={error} />}

      {!loading && !error && (
        <>
          <CalendarFeedBanner onPress={goToSubscribe} />

          {/* Following section */}
          {hasFollowing && (
            <View style={styles.followingSection}>
              <Text style={styles.sectionTitle}>FOLLOWING ({followingItems.length})</Text>
              {followingItems.map((item) => {
                // Build subscribe URL for each entity type
                let subscribeUrl: string | undefined;
                let subscribeName: string | undefined;
                let subscribeDesc: string | undefined;
                if (item.kind === 'org') {
                  subscribeUrl = `${APP_CONFIG.webBaseUrl}/api/organizations/${item.entity.id}/ical`;
                  subscribeName = `${item.entity.name} Events`;
                  subscribeDesc = `Upcoming events from ${item.entity.name}, auto-synced to your calendar.`;
                } else if (item.kind === 'series') {
                  subscribeUrl = `${APP_CONFIG.webBaseUrl}/api/events/series/${item.entity.id}/ical`;
                  subscribeName = item.entity.name;
                  subscribeDesc = `All events in the "${item.entity.name}" series, auto-synced to your calendar.`;
                } else if (item.kind === 'location') {
                  subscribeUrl = `${APP_CONFIG.webBaseUrl}/api/locations/${item.entity.id}/ical`;
                  subscribeName = `Events at ${item.entity.name}`;
                  subscribeDesc = `Upcoming events at ${item.entity.name}, auto-synced to your calendar.`;
                }
                return (
                  <FollowingRow
                    key={`${item.kind}:${item.entity.id}`}
                    item={item}
                    onPress={() => {
                      if (item.kind === 'org') {
                        router.push(`/organization/${item.entity.id}` as never);
                      } else if (item.kind === 'series') {
                        router.push(`/event/${item.entity.id}` as never);
                      } else {
                        openMaps({ name: item.entity.name });
                      }
                    }}
                    onSubscribe={
                      subscribeUrl
                        ? () =>
                            router.push({
                              pathname: '/calendar-subscribe',
                              params: {
                                calendarUrl: subscribeUrl,
                                calendarName: subscribeName,
                                calendarDesc: subscribeDesc,
                              },
                            } as never)
                        : undefined
                    }
                    onUnfollow={() => {
                      if (item.kind === 'org')         toggleStarOrg(item.entity);
                      else if (item.kind === 'series') toggleStarSeries(item.entity);
                      else                             toggleStarLocation(item.entity);
                    }}
                  />
                );
              })}
            </View>
          )}

          {/* Events: individually starred + followed org/series events */}
          {!hasDisplayEvents && !hasFollowing ? (
            <EmptyView
              title="Nothing saved yet"
              subtitle="Tap ★ on any event to save it, or follow an organization or series to see their upcoming events here"
            />
          ) : !hasDisplayEvents && followedLoading ? (
            <View style={styles.followedLoading}>
              <ActivityIndicator size="small" color={THEME.canary} />
              <Text style={styles.followedLoadingText}>Loading events…</Text>
            </View>
          ) : !hasDisplayEvents ? (
            <View style={styles.noEventsHint}>
              <Text style={styles.noEventsHintText}>
                {hasFollowedOrStar
                  ? 'No upcoming events from your followed organizations or series'
                  : 'Tap ★ on any event to save it here'}
              </Text>
            </View>
          ) : (
            <>
              {hasFollowing && (
                <View style={styles.eventsSectionHeader}>
                  <Text style={styles.sectionTitle}>
                    UPCOMING EVENTS ({allDisplayEvents.length})
                  </Text>
                  {followedLoading && (
                    <ActivityIndicator
                      size="small"
                      color={THEME.canary}
                      style={styles.refreshIndicator}
                    />
                  )}
                </View>
              )}
              <FlatList
                data={listItems}
                keyExtractor={(item) =>
                  item.type === 'header' ? `hdr-${item.date}` : `ev-${item.event.id}`
                }
                renderItem={renderEventItem}
                style={styles.list}
              />
            </>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
  },
  list: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flex: 1,
  },
  // ── Calendar feed banner ────────────────────────────────────────────────────
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: THEME.cardBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,230,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  bannerSub: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  // ── Following section ───────────────────────────────────────────────────────
  followingSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  followingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  followingMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    gap: 12,
  },
  followingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,230,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingText: {
    flex: 1,
    gap: 1,
  },
  followingName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textPrimary,
  },
  followingKind: {
    fontSize: 11,
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  followingCalBtn: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  followingStarBtn: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  // ── Events section header ───────────────────────────────────────────────────
  eventsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  refreshIndicator: {
    marginTop: 10,
  },
  // ── Hint / empty / loading ──────────────────────────────────────────────────
  noEventsHint: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  noEventsHintText: {
    fontSize: 13,
    color: THEME.textMuted,
  },
  followedLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  followedLoadingText: {
    fontSize: 13,
    color: THEME.textMuted,
  },
});
