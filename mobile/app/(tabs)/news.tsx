import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ListRenderItem,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { THEME } from '../../lib/theme';
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

      {!loading && !error && announcements.length === 0 && (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No announcements</Text>
          <Text style={styles.emptySubtitle}>
            Check back soon for updates from Leavenworth
          </Text>
        </View>
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
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#1e293b',
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
