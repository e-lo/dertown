import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { THEME, getCategoryColor } from '../../lib/theme';
import { fetchEventById } from '../../lib/api';
import { formatTimeRange, formatDayHeader } from '../../lib/dateUtils';
import { Icon } from '../../components/Icon';
import { useStars } from '../../contexts/StarContext';
import type { MobileEvent } from '../../lib/types';

function openMaps(location: NonNullable<MobileEvent['location']>) {
  const { name, address, latitude, longitude } = location;
  const query = encodeURIComponent(address ?? name);
  if (latitude && longitude) {
    const url =
      Platform.OS === 'ios'
        ? `maps://0,0?q=${query}&ll=${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${query}`;
    Linking.canOpenURL(url)
      .then((can) => {
        Linking.openURL(can ? url : `https://maps.google.com/?q=${latitude},${longitude}`).catch(console.error);
      })
      .catch(console.error);
  } else {
    Linking.openURL(`https://maps.google.com/?q=${query}`);
  }
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<MobileEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { starredIds, toggleStar } = useStars();
  const isStarred = starredIds.has(id ?? '');

  useEffect(() => {
    if (!id) return;
    setEvent(null);
    setLoading(true);
    setError(null);
    fetchEventById(id)
      .then((data) => {
        setEvent(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load event');
        setLoading(false);
      });
  }, [id]);

  const bgColor = getCategoryColor(event?.primary_tag?.name ?? null);

  const { dayOfWeek, dayNum, month } =
    event ? formatDayHeader(event.start_date) : { dayOfWeek: '', dayNum: '', month: '' };

  const timeStr = event
    ? formatTimeRange(event.start_time, event.end_time)
    : '';

  return (
    <>
      <Stack.Screen
        options={{
          title: event?.title ?? 'Event Details',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => {
                  if (!event) return;
                  Share.share({
                    title: event.title,
                    message: `${event.title} — https://dertown.com/events/${event.id}`,
                    url: `https://dertown.com/events/${event.id}`,
                  });
                }}
                style={{ padding: 6 }}
              >
                <Icon name="share" size={20} color={THEME.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => toggleStar(id ?? '')}
                style={{ padding: 6, paddingRight: 0 }}
              >
                <Icon
                  name="star"
                  size={22}
                  color={isStarred ? THEME.starFilled : THEME.starUnstarred}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

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

      {!loading && !error && event && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Hero card */}
          <View style={[styles.hero, { backgroundColor: bgColor }]}>
            <Text style={styles.heroTitle}>{event.title}</Text>
            <Text style={styles.heroDate}>
              {dayOfWeek}, {month} {dayNum}
            </Text>
            {timeStr ? <Text style={styles.heroTime}>{timeStr}</Text> : null}

            <View style={styles.pills}>
              {event.primary_tag ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{event.primary_tag.name}</Text>
                </View>
              ) : null}
              {event.secondary_tag ? (
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{event.secondary_tag.name}</Text>
                </View>
              ) : null}
              {event.registration ? (
                <View style={[styles.pill, styles.regPill]}>
                  <Text style={styles.pillText}>Register</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Details section */}
          <View style={styles.details}>
            {event.location ? (
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => openMaps(event.location!)}
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

            {event.organization ? (
              <View style={styles.detailRow}>
                <Icon name="home" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>
                  {event.organization.name}
                </Text>
              </View>
            ) : null}

            {event.cost ? (
              <View style={styles.detailRow}>
                <Icon name="check" size={18} color={THEME.canary} />
                <Text style={[styles.detailLabel, { flex: 1 }]}>{event.cost}</Text>
              </View>
            ) : null}

            {event.description ? (
              <View style={styles.descriptionBlock}>
                <Text style={styles.description}>{event.description}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {event.website ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => Linking.openURL(event.website!)}
                >
                  <Text style={styles.actionBtnText}>Visit Website</Text>
                </TouchableOpacity>
              ) : null}

              {event.registration && event.website ? (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.registerBtn]}
                  onPress={() => Linking.openURL(event.website!)}
                >
                  <Text style={[styles.actionBtnText, styles.registerBtnText]}>
                    Register
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: THEME.feedBackground,
    alignItems: 'center',
    justifyContent: 'center',
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
  hero: {
    padding: 20,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 6,
    lineHeight: 28,
  },
  heroDate: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textSecondary,
    marginBottom: 2,
  },
  heroTime: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 12,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
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
    color: THEME.textPrimary,
  },
  details: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 0,
  },
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
  },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
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
});
