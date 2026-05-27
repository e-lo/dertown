import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ListRenderItem,
} from 'react-native';
import { useRouter } from 'expo-router';
import { THEME } from '../../lib/theme';
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Starred</Text>
      </View>

      {loading && <LoadingView />}

      {!loading && error && <ErrorView message={error} />}

      {!loading && !error && listItems.length === 0 && (
        <EmptyView
          title="No starred events"
          subtitle="Tap ★ on any event to save it here"
        />
      )}

      {!loading && !error && listItems.length > 0 && (
        <FlatList
          data={listItems}
          keyExtractor={(item) =>
            item.type === 'header' ? `hdr-${item.date}` : `ev-${item.event.id}`
          }
          renderItem={renderItem}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: THEME.tabBarBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textPrimary,
  },
  list: {
    flex: 1,
  },
});
