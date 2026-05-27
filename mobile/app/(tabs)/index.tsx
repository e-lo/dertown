import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItem,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { THEME } from '../../lib/theme';
import { CONSTANTS } from '../../../src/lib/config';
import { fetchEvents } from '../../lib/api';
import { filterUpcoming, groupEventsByDate, getTodayDateString } from '../../lib/dateUtils';
import { EventRow } from '../../components/EventRow';
import { DayHeader } from '../../components/DayHeader';
import { CategoryPills } from '../../components/CategoryPills';
import { DatePickerModal } from '../../components/DatePickerModal';
import { Icon } from '../../components/Icon';
import { useStars } from '../../contexts/StarContext';
import { APP_CONFIG } from '../../lib/app-config';
import type { MobileEvent } from '../../lib/types';

type ListItem =
  | { type: 'header'; date: string }
  | { type: 'event'; event: MobileEvent };

const CATEGORIES = CONSTANTS.tagCategories as unknown as string[];

export default function EventsScreen() {
  const [events, setEvents]                     = useState<MobileEvent[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [selectedCategory, setCategory]         = useState<string | null>(null);
  const [searchQuery, setSearchQuery]           = useState('');
  const [searchExpanded, setSearchExpanded]     = useState(false);
  const [selectedDate, setSelectedDate]         = useState(getTodayDateString());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const { starredIds, toggleStar } = useStars();
  const listRef = useRef<FlatList>(null);
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

  // Reload events whenever this tab comes into focus
  useFocusEffect(loadEvents);

  // Derive filtered list
  const filteredEvents = useMemo(() => {
    let result = events;

    if (selectedCategory) {
      result = result.filter(
        (e) =>
          e.primary_tag?.name === selectedCategory ||
          e.secondary_tag?.name === selectedCategory
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.location?.name.toLowerCase().includes(q) ?? false) ||
          (e.organization?.name.toLowerCase().includes(q) ?? false) ||
          (e.primary_tag?.name.toLowerCase().includes(q) ?? false) ||
          (e.secondary_tag?.name.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [events, selectedCategory, searchQuery]);

  // Flatten grouped events for FlatList
  const listItems: ListItem[] = useMemo(() => {
    const groups = groupEventsByDate(filteredEvents);
    const items: ListItem[] = [];
    for (const group of groups) {
      items.push({ type: 'header', date: group.date });
      for (const event of group.events) {
        items.push({ type: 'event', event });
      }
    }
    return items;
  }, [filteredEvents]);

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    const idx = listItems.findIndex(
      (item) => item.type === 'header' && item.date >= date
    );
    if (idx >= 0) {
      listRef.current?.scrollToIndex({ index: idx, animated: true, viewOffset: 0 });
    }
  }

  const headerLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setDatePickerVisible(true)} style={styles.headerBtn}>
          <Icon name="calendar" size={22} color={THEME.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{headerLabel} · {APP_CONFIG.townName}</Text>

        <TouchableOpacity
          onPress={() => setSearchExpanded((v) => !v)}
          style={styles.headerBtn}
        >
          <Icon name={searchExpanded ? 'x' : 'search'} size={22} color={THEME.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Inline search bar */}
      {searchExpanded && (
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={THEME.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events, locations, orgs…"
            placeholderTextColor={THEME.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="x" size={16} color={THEME.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Category pills */}
      <CategoryPills
        categories={CATEGORIES}
        selected={selectedCategory}
        onSelect={setCategory}
      />

      {/* Events list */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={THEME.canary} size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadEvents} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && (
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item) =>
            item.type === 'header' ? `hdr-${item.date}` : `ev-${item.event.id}`
          }
          renderItem={renderItem}
          style={styles.list}
          onScrollToIndexFailed={() => {/* no-op — index may be out of range */}}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          }
        />
      )}

      <DatePickerModal
        visible={datePickerVisible}
        selectedDate={selectedDate}
        onSelect={handleDateSelect}
        onClose={() => setDatePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: THEME.tabBarBackground,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.cardBackground,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: THEME.textPrimary,
  },
  list: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    color: THEME.errorRed,
    fontSize: 14,
    marginBottom: 12,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.canary,
  },
  retryText: {
    color: '#111827',
    fontWeight: '700',
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 15,
  },
});
