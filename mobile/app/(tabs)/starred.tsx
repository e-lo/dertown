import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItem,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { THEME } from '../../lib/theme';
import { fetchEvents } from '../../lib/api';
import { filterUpcoming, groupEventsByDate } from '../../lib/dateUtils';
import { EventRow } from '../../components/EventRow';
import { DayHeader } from '../../components/DayHeader';
import { useStars } from '../../contexts/StarContext';
import type { MobileEvent } from '../../lib/types';

type ListItem =
  | { type: 'header'; date: string }
  | { type: 'event'; event: MobileEvent };

export default function StarredScreen() {
  const { starredIds, toggleStar } = useStars();
  const [events, setEvents]   = useState<MobileEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  const loadEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchEvents({})
      .then((data) => {
        setEvents(filterUpcoming(data));
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load events');
        setLoading(false);
      });
  }, []);

  useFocusEffect(loadEvents);

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

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={THEME.canary} size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && listItems.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No starred events</Text>
          <Text style={styles.emptySubtitle}>
            Tap ★ on any event to save it here
          </Text>
        </View>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: THEME.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  list: {
    flex: 1,
  },
});
