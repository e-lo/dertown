import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ListRenderItem,
  AppState,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingView, ErrorView, EmptyView } from '../../components/ScreenStates';
import { AppHeader } from '../../components/AppHeader';
import { Icon } from '../../components/Icon';
import { THEME } from '../../lib/theme';
import { APP_CONFIG } from '../../lib/app-config';
import { fetchAnnouncements } from '../../lib/api';
import { getCache, setCache } from '../../lib/cache';
import type { MobileAnnouncement } from '../../lib/types';

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

/** Matches web app definition: new if show_at or created_at is within 72 hours. */
function isNew(item: MobileAnnouncement): boolean {
  const cutoff = Date.now() - SEVENTY_TWO_HOURS_MS;
  const showAt   = item.show_at   ? new Date(item.show_at).getTime()   : null;
  const createdAt = item.created_at ? new Date(item.created_at).getTime() : null;
  return (showAt != null && showAt >= cutoff) || (createdAt != null && createdAt >= cutoff);
}

function AnnouncementCard({ item }: { item: MobileAnnouncement }) {
  const fresh = isNew(item);
  const bgColor = fresh ? THEME.canary : THEME.cardBackground;
  // On canary yellow use near-black text (matches Arts+Culture cards); on dark card use white text
  const textColor       = fresh ? '#111111' : THEME.textPrimary;
  const textColorMuted  = fresh ? 'rgba(0,0,0,0.6)' : THEME.textSecondary;

  const handlePress = () => {
    if (item.link) {
      WebBrowser.openBrowserAsync(item.link).catch(() => { /* ignore */ });
    }
  };

  const hasLink = Boolean(item.link);

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: bgColor }]}
      onPress={handlePress}
      activeOpacity={hasLink ? 0.75 : 1}
      disabled={!hasLink}
    >
      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
            {item.title}
          </Text>
          {fresh && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>
        <Text style={[styles.message, { color: textColorMuted }]} numberOfLines={3}>
          {item.message}
        </Text>
      </View>

      {/* Right: external-link indicator */}
      {hasLink && (
        <View style={styles.linkIcon}>
          <Icon name="external-link" size={18} color={textColorMuted} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const CACHE_KEY = 'announcements:all';
const ANNOUNCEMENTS_TTL_MS = 5 * 60 * 1000; // 5 min — more time-sensitive than events

export default function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<MobileAnnouncement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const fetchingRef                       = useRef(false);

  const doFetch = useCallback(async (opts: { pullToRefresh?: boolean } = {}) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (opts.pullToRefresh) setRefreshing(true);
    try {
      const data = await fetchAnnouncements();
      setAnnouncements(data);
      setError(null);
      await setCache(CACHE_KEY, data);
    } catch (err: unknown) {
      setAnnouncements((prev) => {
        if (prev.length === 0) setError((err as Error).message ?? 'Failed to load announcements');
        return prev;
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
      fetchingRef.current = false;
    }
  }, []);

  // Mount: show cache instantly, background-refresh if stale
  useEffect(() => {
    async function init() {
      const cached = await getCache<MobileAnnouncement[]>(CACHE_KEY, ANNOUNCEMENTS_TTL_MS);
      if (cached) {
        setAnnouncements(cached.data);
        setLoading(false);
        if (cached.stale) doFetch();
      } else {
        doFetch();
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foreground: silently refresh if stale
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        getCache<MobileAnnouncement[]>(CACHE_KEY, ANNOUNCEMENTS_TTL_MS).then((cached) => {
          if (!cached || cached.stale) doFetch();
        });
      }
    });
    return () => sub.remove();
  }, [doFetch]);

  const renderItem: ListRenderItem<MobileAnnouncement> = ({ item }) => (
    <AnnouncementCard item={item} />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <AppHeader />

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
          refreshing={refreshing}
          onRefresh={() => doFetch({ pullToRefresh: true })}
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
  list: {
    flex: 1,
  },
  // Full-bleed row — matches EventRow visual rhythm
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  newBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  newBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffe600',
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  linkIcon: {
    paddingLeft: 12,
    alignSelf: 'center',
  },
});
