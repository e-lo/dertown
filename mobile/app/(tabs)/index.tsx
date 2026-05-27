import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { THEME } from '../../lib/theme';
import { groupEventsByDate, getTodayDateString } from '../../lib/dateUtils';
import { LoadingView, ErrorView, EmptyView } from '../../components/ScreenStates';
import { useEventList } from '../../hooks/useEventList';
import { EventRow } from '../../components/EventRow';
import { DayHeader } from '../../components/DayHeader';
import { DatePickerModal } from '../../components/DatePickerModal';
import { Icon } from '../../components/Icon';
import { useStars } from '../../contexts/StarContext';
import { APP_CONFIG } from '../../lib/app-config';
import type { MobileEvent } from '../../lib/types';

type ListItem =
  | { type: 'header'; date: string }
  | { type: 'event'; event: MobileEvent };

export default function EventsScreen() {
  const { events, loading, error, reload } = useEventList();
  const [searchQuery, setSearchQuery]           = useState('');
  const [searchExpanded, setSearchExpanded]     = useState(false);
  const [selectedDate, setSelectedDate]         = useState(getTodayDateString());
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const { starredIds, toggleStar } = useStars();
  const listRef = useRef<FlatList>(null);
  const router = useRouter();

  // Derive filtered list
  const filteredEvents = useMemo(() => {
    let result = events;

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
  }, [events, searchQuery]);

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

      {/* Events list */}
      {loading && <LoadingView />}

      {!loading && error && <ErrorView message={error} onRetry={reload} />}

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
          ListEmptyComponent={<EmptyView title="No events found" />}
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
});
