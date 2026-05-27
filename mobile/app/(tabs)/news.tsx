import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LoadingView, ErrorView, EmptyView } from '../../components/ScreenStates';
import { THEME } from '../../lib/theme';
import { APP_CONFIG } from '../../lib/app-config';
import { fetchAnnouncements } from '../../lib/api';
import type { MobileAnnouncement } from '../../lib/types';

function AnnouncementCard({ item }: { item: MobileAnnouncement }) {
  const date = new Date(item.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDate}>{date}</Text>
      <Text style={styles.cardMessage}>{item.message}</Text>
    </View>
  );
}

export default function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);

  const loadAnnouncements = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAnnouncements()
      .then((data) => {
        setAnnouncements(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load announcements');
        setLoading(false);
      });
  }, []);

  useFocusEffect(loadAnnouncements);

  const renderItem: ListRenderItem<MobileAnnouncement> = ({ item }) => (
    <AnnouncementCard item={item} />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Announcements</Text>
      </View>

      {loading && <LoadingView />}

      {!loading && error && <ErrorView message={error} />}

      {!loading && !error && announcements.length === 0 && (
        <EmptyView
          title="No announcements"
          subtitle={`Check back soon for updates from ${APP_CONFIG.townName}`}
        />
      )}

      {!loading && !error && announcements.length > 0 && (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={styles.listContent}
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: THEME.cardBackground,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  cardDate: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  cardMessage: {
    fontSize: 14,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
});
