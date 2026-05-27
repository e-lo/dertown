import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { THEME } from '../../lib/theme';
import { AppHeader } from '../../components/AppHeader';
import { Icon } from '../../components/Icon';
import { groupEventsByDate } from '../../lib/dateUtils';
import { LoadingView, ErrorView, EmptyView } from '../../components/ScreenStates';
import { useEventList } from '../../hooks/useEventList';
import { EventRow } from '../../components/EventRow';
import { DayHeader } from '../../components/DayHeader';
import { useStars } from '../../contexts/StarContext';
import type { MobileEvent } from '../../lib/types';

type ListItem =
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

export default function StarredScreen() {
  const { starredIds, toggleStar } = useStars();
  const { events, loading, error } = useEventList();
  const router = useRouter();

  const starredEvents = useMemo(
    () => events.filter((e) => starredIds.has(e.id)),
    [events, starredIds]
  );

  const listItems: ListItem[] = useMemo(() => {
    const groups = groupEventsByDate(starredEvents);
    const items: ListItem[] = [];
    for (const group of groups) {
      items.push({ type: 'header', date: group.date });
      for (const event of group.events) {
        items.push({ type: 'event', event });
      }
    }
    return items;
  }, [starredEvents]);

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    if (item.type === 'header') return <DayHeader dateStr={item.date} />;
    return (
      <EventRow
        event={item.event}
        isStarred={true}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: item.event.id } })}
        onStar={() => toggleStar(item.event.id)}
      />
    );
  };

  const goToSubscribe = () => router.push('/calendar-subscribe' as never);

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader />

      {loading && <LoadingView />}

      {!loading && error && <ErrorView message={error} />}

      {!loading && !error && (
        <>
          {/* Always-visible calendar feed banner */}
          <CalendarFeedBanner onPress={goToSubscribe} />

          {listItems.length === 0 ? (
            <EmptyView
              title="No starred events"
              subtitle="Tap ★ on any event to save it here"
            />
          ) : (
            <FlatList
              data={listItems}
              keyExtractor={(item) =>
                item.type === 'header' ? `hdr-${item.date}` : `ev-${item.event.id}`
              }
              renderItem={renderItem}
              style={styles.list}
            />
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
    flex: 1,
  },
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
});
