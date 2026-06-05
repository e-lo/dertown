import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import { THEME } from '../../lib/theme';
import { Icon } from '../../components/Icon';
import { AppHeader } from '../../components/AppHeader';
import { fetchMapVenues } from '../../lib/api';
import { getCache, setCache } from '../../lib/cache';
import type { MapVenue, MapVenueEvent } from '../../lib/api';
import { APP_CONFIG } from '../../lib/app-config';

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const CACHE_TTL = 10 * 60 * 1000; // 10 min
const DAY_OPTIONS = [3, 10] as const;
type DayWindow = typeof DAY_OPTIONS[number];
const cacheKey = (d: DayWindow) => `map:venues:${d}` as const;

const TOWN_CENTER: [number, number] = [APP_CONFIG.mapCenter.longitude, APP_CONFIG.mapCenter.latitude];
const DEFAULT_ZOOM = 13.5;

// ── GeoJSON builder ───────────────────────────────────────────────────────────

function venuesToGeoJSON(venues: MapVenue[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: venues.map((v) => ({
      type: 'Feature',
      id: v.id,
      geometry: { type: 'Point', coordinates: [v.longitude, v.latitude] },
      properties: {
        id:         v.id,
        name:       v.name,
        eventCount: v.eventCount,
        color: THEME.canary,
      },
    })),
  };
}

// ── Single-event popup ────────────────────────────────────────────────────────

function SingleEventPopup({
  event,
  venueName,
  onClose,
  onView,
}: {
  event: MapVenueEvent;
  venueName: string;
  onClose: () => void;
  onView: () => void;
}) {
  return (
    <View style={styles.singlePopup}>
      <TouchableOpacity style={styles.popupClose} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Icon name="x" size={16} color={THEME.textMuted} />
      </TouchableOpacity>
      <Text style={styles.popupTag}>{event.tag || 'Event'}</Text>
      <Text style={styles.popupTitle} numberOfLines={2}>{event.title}</Text>
      <Text style={styles.popupMeta}>
        {event.time !== 'All day' ? event.time : 'All day'} · {venueName}
      </Text>
      <TouchableOpacity style={styles.popupBtn} onPress={onView} activeOpacity={0.8}>
        <Text style={styles.popupBtnText}>View Event →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Multi-event venue sheet ───────────────────────────────────────────────────

function VenueSheet({
  venue,
  onClose,
  onSelectEvent,
}: {
  venue: MapVenue;
  onClose: () => void;
  onSelectEvent: (event: MapVenueEvent) => void;
}) {
  return (
    <View style={styles.venueSheet}>
      <View style={styles.venueSheetHeader}>
        <View style={styles.venueSheetTitles}>
          <Text style={styles.venueSheetName} numberOfLines={1}>{venue.name}</Text>
          <Text style={styles.venueSheetCount}>{venue.eventCount} events here</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="x" size={20} color={THEME.textMuted} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.venueEventList} showsVerticalScrollIndicator={false}>
        {venue.events.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.venueEventRow}
            onPress={() => onSelectEvent(event)}
            activeOpacity={0.7}
          >
            <View style={[styles.venueDot, { backgroundColor: THEME.canary }]} />
            <View style={styles.venueEventText}>
              <Text style={styles.venueEventTitle} numberOfLines={1}>{event.title}</Text>
              <Text style={styles.venueEventMeta}>
                {event.time !== 'All day' ? event.time : 'All day'}
                {event.tag ? ` · ${event.tag}` : ''}
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={THEME.textMuted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Map screen ────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const router = useRouter();
  const [venues, setVenues]     = useState<MapVenue[]>([]);
  const [loading, setLoading]   = useState(true);
  const [days, setDays]         = useState<DayWindow>(3);
  const [selectedVenue, setSelectedVenue] = useState<MapVenue | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MapVenueEvent | null>(null);
  const fetchingRef    = useRef(false);
  const daysRef        = useRef<DayWindow>(3);
  const cameraRef      = useRef<MapboxGL.Camera>(null);
  const shapeSourceRef = useRef<MapboxGL.ShapeSource>(null);

  const doFetch = useCallback(async (d: DayWindow) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const data = await fetchMapVenues(d);
      setVenues(data);
      await setCache(cacheKey(d), data);
    } catch {
      // Silently keep whatever is already displayed
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Mount: show cache instantly, background-refresh if stale
  useEffect(() => {
    async function init() {
      const cached = await getCache<MapVenue[]>(cacheKey(3), CACHE_TTL);
      if (cached) {
        setVenues(cached.data);
        setLoading(false);
        if (cached.stale) doFetch(3);
      } else {
        doFetch(3);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When day window changes — load from cache or fetch fresh
  useEffect(() => {
    daysRef.current = days;
    setLoading(true);
    setVenues([]);
    async function switchWindow() {
      const cached = await getCache<MapVenue[]>(cacheKey(days), CACHE_TTL);
      if (cached) {
        setVenues(cached.data);
        setLoading(false);
        if (cached.stale) doFetch(days);
      } else {
        doFetch(days);
      }
    }
    switchWindow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Foreground: silently refresh if stale
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        getCache<MapVenue[]>(cacheKey(daysRef.current), CACHE_TTL).then((c) => {
          if (!c || c.stale) doFetch(daysRef.current);
        });
      }
    });
    return () => sub.remove();
  }, [doFetch]);

  const dismiss = useCallback(() => {
    setSelectedVenue(null);
    setSelectedEvent(null);
  }, []);

  const handleFeaturePress = useCallback(
    async (e: { features: GeoJSON.Feature[] }) => {
      if (e.features.length === 0) return;
      const feature = e.features[0];

      // Cluster tap — zoom in to expand
      if (feature.properties?.cluster) {
        try {
          const zoom = await shapeSourceRef.current?.getClusterExpansionZoom(feature as GeoJSON.Feature<GeoJSON.Point>);
          cameraRef.current?.setCamera({
            centerCoordinate: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
            zoomLevel: (zoom ?? DEFAULT_ZOOM) + 0.5,
            animationDuration: 400,
          });
        } catch {
          // Fallback: just fly to cluster center
          cameraRef.current?.flyTo(
            (feature.geometry as GeoJSON.Point).coordinates as [number, number],
            400
          );
        }
        return;
      }

      // Individual venue pin
      const venueId = feature.properties?.id as string | undefined;
      if (!venueId) return;
      const venue = venues.find((v) => v.id === venueId);
      if (!venue) return;

      dismiss();
      if (venue.eventCount === 1) {
        setSelectedEvent(venue.events[0]);
        setSelectedVenue(venue);
      } else {
        setSelectedVenue(venue);
      }
    },
    [venues, dismiss]
  );

  const totalEvents = venues.reduce((n, v) => n + v.eventCount, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader />

      <View style={styles.mapWrapper}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={THEME.canary} size="large" />
          </View>
        )}

        <MapboxGL.MapView
          style={styles.map}
          styleURL="mapbox://styles/mapbox/dark-v11"
          onPress={dismiss}
          compassEnabled={false}
          scaleBarEnabled={false}
          logoEnabled={false}
          attributionEnabled={false}
        >
          <MapboxGL.Camera
            ref={cameraRef}
            defaultSettings={{ centerCoordinate: TOWN_CENTER, zoomLevel: DEFAULT_ZOOM }}
          />

          {venues.length > 0 && (
            <MapboxGL.ShapeSource
              ref={shapeSourceRef}
              id="venues"
              shape={venuesToGeoJSON(venues)}
              cluster
              clusterRadius={50}
              clusterMaxZoom={13}
              onPress={handleFeaturePress}
            >
              {/* ── Cluster pins (zoomed out) ─────────────────────────────── */}
              <MapboxGL.CircleLayer
                id="cluster-circle"
                filter={['has', 'point_count']}
                style={{
                  circleRadius: 22,
                  circleColor: THEME.canary,
                  circleOpacity: 0.92,
                  circleStrokeWidth: 2,
                  circleStrokeColor: 'rgba(255,255,255,0.4)',
                }}
              />
              <MapboxGL.SymbolLayer
                id="cluster-count"
                filter={['has', 'point_count']}
                style={{
                  textField: ['get', 'point_count_abbreviated'],
                  textSize: 13,
                  textColor: '#111111',
                  textFont: ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
                  textAllowOverlap: true,
                }}
              />

              {/* ── Individual venue pins (zoomed in) ────────────────────── */}
              {/* Soft glow ring behind multi-event pins */}
              <MapboxGL.CircleLayer
                id="venue-glow"
                filter={['all', ['!', ['has', 'point_count']], ['>', ['get', 'eventCount'], 1]]}
                style={{
                  circleRadius: 20,
                  circleColor: ['get', 'color'],
                  circleOpacity: 0.2,
                  circleStrokeWidth: 0,
                }}
              />
              {/* Main pin */}
              <MapboxGL.CircleLayer
                id="venue-pin"
                filter={['!', ['has', 'point_count']]}
                style={{
                  circleRadius: ['case', ['>', ['get', 'eventCount'], 1], 14, 9],
                  circleColor: ['get', 'color'],
                  circleStrokeWidth: 2,
                  circleStrokeColor: 'rgba(255,255,255,0.35)',
                }}
              />
              {/* Count label on multi-event venue pins */}
              <MapboxGL.SymbolLayer
                id="venue-count"
                filter={['all', ['!', ['has', 'point_count']], ['>', ['get', 'eventCount'], 1]]}
                style={{
                  textField: ['to-string', ['get', 'eventCount']],
                  textSize: 11,
                  textColor: '#ffffff',
                  textFont: ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
                  textAllowOverlap: true,
                }}
              />
            </MapboxGL.ShapeSource>
          )}
        </MapboxGL.MapView>

        {/* Day window toggle + event count */}
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.segmented}>
            {DAY_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.segment, days === d && styles.segmentActive]}
                onPress={() => setDays(d)}
                activeOpacity={0.8}
              >
                <Text style={[styles.segmentText, days === d && styles.segmentTextActive]}>
                  {d === 3 ? '3 days' : '10 days'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!loading && (
            <View style={styles.countChip}>
              <Text style={styles.countText}>
                {totalEvents} event{totalEvents !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Single-event popup */}
        {selectedVenue && selectedEvent && (
          <SingleEventPopup
            event={selectedEvent}
            venueName={selectedVenue.name}
            onClose={dismiss}
            onView={() => {
              dismiss();
              router.push(`/event/${selectedEvent.id}` as never);
            }}
          />
        )}

        {/* Multi-event venue sheet */}
        {selectedVenue && !selectedEvent && (
          <VenueSheet
            venue={selectedVenue}
            onClose={dismiss}
            onSelectEvent={(event) => {
              dismiss();
              router.push(`/event/${event.id}` as never);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: THEME.feedBackground },
  mapWrapper: { flex: 1, position: 'relative' },
  map:        { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.feedBackground,
    zIndex: 10,
  },

  topBar: {
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  segmentActive: {
    backgroundColor: THEME.canary,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMuted,
  },
  segmentTextActive: {
    color: '#111111',
  },
  countChip: {
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  countText: { fontSize: 12, fontWeight: '700', color: THEME.textMuted },

  // Single-event popup
  singlePopup: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    backgroundColor: THEME.cardBackground, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  popupClose:   { position: 'absolute', top: 12, right: 12, padding: 4 },
  popupTag:     { fontSize: 10, fontWeight: '700', color: THEME.canary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  popupTitle:   { fontSize: 16, fontWeight: '700', color: THEME.textPrimary, lineHeight: 22, marginBottom: 4, paddingRight: 24 },
  popupMeta:    { fontSize: 13, color: THEME.textSecondary, marginBottom: 12 },
  popupBtn:     { backgroundColor: THEME.canary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  popupBtnText: { fontSize: 14, fontWeight: '700', color: '#111111' },

  // Multi-event venue sheet
  venueSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: THEME.cardBackground,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: '50%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  venueSheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  venueSheetTitles: { flex: 1, marginRight: 12 },
  venueSheetName:   { fontSize: 16, fontWeight: '700', color: THEME.textPrimary },
  venueSheetCount:  { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  venueEventList:   { flex: 1 },
  venueEventRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  venueDot:        { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  venueEventText:  { flex: 1 },
  venueEventTitle: { fontSize: 14, fontWeight: '600', color: THEME.textPrimary },
  venueEventMeta:  { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
});
